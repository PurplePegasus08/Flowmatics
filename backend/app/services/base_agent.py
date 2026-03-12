import io
import json
import re
import pandas as pd
import numpy as np
from typing import Optional, List, Tuple, Dict, Any
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logger import get_logger
from app.core.storage import DiskStore
from app.models.agent_state import AgentState, UndoEntry
from app.core.cache import llm_cache

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

PERSONAS = {
    "Scientist": """You are an expert Data Scientist AI. 
Focus on practical, clean, and executable analysis. Use standard libraries (pandas, numpy, etc.) effectively.
Avoid over-engineering. Your code should be the most direct path to the user's answer. 
Briefly explain insights, but keep the implementation lightweight.""",
    "Analyst": """You are a high-level Business Analyst AI. 
Focus on trends, ROI, and actionable business logic. 
Be extremely concise. If the user asks for a simple calculation, provide ONLY that calculation.
Focus on the 'So What?' rather than the 'How'.""",
    "Designer": """You are a Data Visualization Designer AI. 
Focus on beautiful, intuitive charts and UX. 
Suggest the most aesthetic way to show data. Keep reasoning short and focus on the visual output."""
}

class BaseAgentService(ABC):
    """Abstract base class for all agent services."""
    
    def _get_stats(self, work_id: str) -> str:
        if not work_id: return "No data."
        
        # Cache stats per work_id
        cache_key = f"stats_{work_id}"
        cached = llm_cache.get(cache_key)
        if cached: return cached

        try:
            df = store.get_df(work_id)
            buf = io.StringIO()
            df.info(buf=buf)
            
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            cat_cols = df.select_dtypes(include=['object', 'category']).columns
            
            numeric_desc = df[numeric_cols].describe().to_string() if not numeric_cols.empty else "No numeric columns."
            
            cat_summary = ""
            for col in cat_cols[:10]:
                vc = df[col].value_counts().head(5).to_dict()
                cat_summary += f"- {col}: {vc}\n"
            
            missing = df.isna().sum()
            missing_str = str(missing[missing > 0]) if missing.sum() > 0 else 'None'
            
            stats_text = f"Shape: {df.shape}\nMissing Values:\n{missing_str}\n\nNumeric Summary:\n{numeric_desc}\n\nCategorical Top Values:\n{cat_summary}\n\nInfo:\n{buf.getvalue()}"
            
            llm_cache.set(cache_key, stats_text, ttl=3600)
            return stats_text
        except Exception as e:
            logger.error(f"Stats error for {work_id}: {e}")
            return f"Stats error: {e}"

    def _get_schema_sample(self, work_id: str, n: int = 3) -> Tuple[List[str], List[dict]]:
        try:
            df = store.get_df(work_id)
            df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            return list(df_safe.columns), df_safe.head(n).to_dict(orient='records')
        except Exception as e:
            logger.error(f"Error getting schema sample: {e}")
            return [], []

    def build_prompt(self, state: AgentState) -> str:
        cols, sample = self._get_schema_sample(state.work_id, n=3)
        stats = self._get_stats(state.work_id)
        persona = PERSONAS.get(state.persona, PERSONAS["Scientist"])
        
        # Dataset Context Enhancement
        context_description = ""
        if state.dataset_description:
            context_description = f"\nUSER PROVIDED DATASET DESCRIPTION/GOAL:\n{state.dataset_description}\n"

        history = ""
        if state.chat_history:
            for msg in state.chat_history[-4:]:
                role = "User" if msg.get("role") == "user" else "AI"
                parts = msg.get("parts", [])
                text = parts[0].get("text", "") if parts else msg.get("content", "")
                history += f"{role}: {text}\n"

        return f"""{persona}

DATASET CONTEXT:
{stats}
SCHEMA SAMPLE: {json.dumps(sample, default=str)}
{context_description}
INSTRUCTIONS:
You are a professional data engine. Solve the request below.
- Keep output CONCISE. Do not include boilerplate or extra analysis unless asked.
- CODE STYLE: Use "Minimum Viable Code".
- **CRITICAL**: The dataframe is already loaded and available as a variable named `df`.
- **STRICTLY FORBIDDEN**: Do NOT use `pd.read_csv`, `pd.read_json`, or any I/O functions. Work directly on the existing `df`.
- **TRANSFORMATIONS**: For feature engineering (creating columns, scaling, etc.), use "action": "code".
- If you need to visualize, use "action": "visualize".
- FOR OUTPUT: You MUST return a JSON block at the VERY END.
- Include 3-4 "suggested_next_steps" (as strings) relevant to the data and goal.

USER REQUEST: {state.user_message}
{history}
RESPONSE FORMAT (JSON):
{{
    "reasoning": "Direct technical rationale.",
    "action": "answer|code|visualize|auto_clean",
    "content": "Result content or python script",
    "explanation": "Brief human summary",
    "suggested_next_steps": ["step 1", "step 2", "step 3"],
    "title": "Viz Title",
    "type": "bar|line|scatter|pie|area|table|distribution|histogram",
    "xAxisKey": "col_name",
    "yAxisKey": "col_name"
}}
"""

    def push_undo(self, state: AgentState, desc: str):
        if state.work_id:
            try:
                MAX_UNDO = 10
                if len(state.history) >= MAX_UNDO:
                    oldest = state.history.pop(0)
                    store.delete(oldest.snapshot_key)
                df = store.get_df(state.work_id)
                snapshot_key = store.write_df(df)
                state.history.append(UndoEntry(
                    description=desc, 
                    snapshot_key=snapshot_key,
                    transformation_report=list(state.transformation_report)
                ))
            except Exception as e:
                logger.error(f"Failed to create undo snapshot: {e}")

    def undo(self, state: AgentState) -> AgentState:
        if not state.history:
            state.user_message = "Nothing to undo."
        else:
            entry = state.history.pop()
            state.work_id = entry.snapshot_key
            state.transformation_report = entry.transformation_report
            state.user_message = f"Undone: {entry.description}"
        state.next_node = "human_input"
        return state

    def upload(self, state: AgentState, file_content: bytes, filename: str = "data.csv", description: str = "") -> AgentState:
        try:
            if filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(file_content))
            else:
                try: df = pd.read_csv(io.StringIO(file_content.decode("utf-8")))
                except UnicodeDecodeError: df = pd.read_csv(io.BytesIO(file_content), encoding='latin1')
            state.raw_id = store.write_df(df)
            state.work_id = state.raw_id
            state.dataset_description = description
            state.user_message = f"Loaded {len(df):,} rows × {len(df.columns)} columns"
            state.next_node = "human_input"
            return state
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            state.error = f"Upload failed: {str(e)}"
            state.next_node = "human_input"
            return state

    def run_cycle(self, state: AgentState) -> AgentState:
        """Run the agent cycle until human input is required or safety limit reached."""
        safety = 0
        while state.next_node != "human_input" and safety < 10:
            if state.next_node == "execute":
                state = self.execute(state)
            elif state.next_node == "undo":
                state = self.undo(state)
            else:
                break
            safety += 1
        return state

    @abstractmethod
    def execute(self, state: AgentState) -> AgentState:
        """Execute the current node's logic."""
        pass
