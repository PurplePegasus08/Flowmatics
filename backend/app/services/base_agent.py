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

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

PERSONAS = {
    "Scientist": """You are an expert Data Scientist AI with a PhD in Statistics. 
Follow strict statistical rigor. Focus on data distribution, outliers, correlations, and machine learning potential.
Be precise, technical, and objective. Always explain the 'why' behind your statistical choices.""",
    "Analyst": """You are a world-class Business Intelligence & Finance Analyst AI. 
Focus on high-level trends, ROI, operational efficiency, and actionable business insights. 
Be concise, practical, and focus on the 'So What?' of the data. Translate technical metrics into business value.""",
    "Designer": """You are a creative Data Visualization Designer AI. 
Focus on visual storytelling, beautiful charts, and user experience. 
Suggest the most aesthetically pleasing and intuitive ways to represent data patterns. Focus on clarity and 'wow' factor."""
}

class BaseAgentService(ABC):
    """Abstract base class for all agent services."""
    
    def _get_stats(self, work_id: str) -> str:
        if not work_id: return "No data."
        try:
            df = store.get_df(work_id)
            buf = io.StringIO()
            df.info(buf=buf)
            
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            cat_cols = df.select_dtypes(include=['object', 'category']).columns
            
            numeric_desc = df[numeric_cols].describe().to_string() if not numeric_cols.empty else "No numeric columns."
            
            # Categorical breakdown
            cat_summary = ""
            for col in cat_cols[:10]: # Limit to first 10 cat columns for prompt size
                vc = df[col].value_counts().head(5).to_dict()
                cat_summary += f"- {col}: {vc}\n"
            
            missing = df.isna().sum()
            missing_str = str(missing[missing > 0]) if missing.sum() > 0 else 'None'
            
            return f"""
Shape: {df.shape}
Missing Values:
{missing_str}

Numeric Summary:
{numeric_desc}

Categorical Top Values:
{cat_summary if cat_summary else "None"}

Info:
{buf.getvalue()}
"""
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
        err = f"\nError: {state.error}\nPlease fix the error and try again." if state.error else ""
        retry = f"\nRetry {state.retry_count + 1}/{state.MAX_RETRIES}" if state.retry_count else ""
        
        history_txt = ""
        if state.chat_history:
            history_txt = "\n**Conversation History:**\n"
            for msg in state.chat_history[-6:]:
                role = "User" if msg.get("role") == "user" else "Assistant"
                text = msg.get("parts", [{"text": ""}])[0].get("text", "")
                history_txt += f"{role}: {text}\n"
        
        cols, sample = self._get_schema_sample(state.work_id, n=5)
        stats = self._get_stats(state.work_id)
        persona_prompt = PERSONAS.get(state.persona, PERSONAS["Scientist"])
        
        return f"""{persona_prompt}

**Your Mission:** Solve the user's request using the available tools. Be smart, proactive, and precise.

**Current Dataset Summary:**
{stats}

**Available Columns:** {', '.join(cols)}

**Sample Data (first 5 rows):**
{json.dumps(sample, default=str, indent=2)}

{history_txt}
**User Request:** "{state.user_message}"
{err}{retry}

**Instructions:**
1. FIRST, provide a brief (1-2 sentences) natural language explanation of your plan.
2. SECOND, provide your final action in a clean JSON block.
3. Your FINAL response must end with the JSON block.

**Response Format REQUIRED (within a markdown code block):**
```json
{{
    "reasoning": "Detailed technical rationale.",
    "action": "action_name",
    "content": "action_content or answer_text",
    "explanation": "Brief user-facing summary",
    "title": "Visualization Title",
    "type": "Chart Type",
    "xAxisKey": "X Axis",
    "yAxisKey": "Y Axis"
}}
```

**Now provide your response:**"""

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

    def upload(self, state: AgentState, file_content: bytes, filename: str = "data.csv") -> AgentState:
        try:
            if filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(file_content))
            else:
                try: df = pd.read_csv(io.StringIO(file_content.decode("utf-8")))
                except UnicodeDecodeError: df = pd.read_csv(io.BytesIO(file_content), encoding='latin1')
            state.raw_id = store.write_df(df)
            state.work_id = state.raw_id
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
