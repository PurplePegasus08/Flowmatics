import io
import json
import re
import pandas as pd
import numpy as np
from typing import Optional, List, Tuple
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from logger import get_logger
from storage import DiskStore
from cache import llm_cache
from models import AgentState
from services.execution_service import exec_code, compare_dataframes

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

class AgentService:
    def __init__(self):
        self.llm = self._init_llm()

    def _init_llm(self):
        try:
            llm = ChatGoogleGenerativeAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                google_api_key=settings.api_key,
                timeout=settings.llm_timeout_seconds
            )
            logger.info(f"LLM initialized: {settings.llm_model}")
            return llm
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            return None

    def _get_stats(self, work_id: str) -> str:
        if not work_id:
            return "No data."
        try:
            df = store.get_df(work_id)
            buf = io.StringIO()
            df.info(buf=buf)
            missing = df.isna().sum()
            missing_str = str(missing[missing > 0]) if missing.sum() > 0 else 'None'
            return f"Shape: {df.shape}\nMissing:\n{missing_str}\n{buf.getvalue()}"
        except Exception as e:
            logger.error(f"Stats error for {work_id}: {e}")
            return f"Stats error: {e}"

    def _get_schema_sample(self, work_id: str, n: int = 3) -> Tuple[List[str], List[dict]]:
        try:
            df = store.get_df(work_id)
            df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            cols = list(df_safe.columns)
            sample = df_safe.head(n).to_dict(orient='records')
            return cols, sample
        except Exception as e:
            logger.error(f"Error getting schema sample: {e}")
            return [], []

    def build_prompt(self, state: AgentState) -> str:
        err = f"\nError: {state.error}\nPlease fix the error and try again." if state.error else ""
        retry = f"\nRetry {state.retry_count + 1}/{state.MAX_RETRIES}" if state.retry_count else ""
        
        # Format chat history
        history_txt = ""
        if state.chat_history:
            history_txt = "\n**Conversation History:**\n"
            for msg in state.chat_history[-6:]:
                role = "User" if msg.get("role") == "user" else "Assistant"
                parts = msg.get("parts", [{"text": ""}])
                text = parts[0].get("text", "")
                history_txt += f"{role}: {text}\n"
        
        cols, sample = self._get_schema_sample(state.work_id, n=5)
        sample_txt = json.dumps(sample, default=str, ensure_ascii=False, indent=2)
        cols_txt = ', '.join(cols)
        
        stats = self._get_stats(state.work_id)
        
        prompt = f"""You are an expert data analyst AI assistant.
**Current Dataset Summary:**
{stats}

**Available Columns:** {cols_txt}

**Sample Data (first 5 rows):**
{sample_txt}

{history_txt}
**User Request:** "{state.user_message}"
{err}{retry}

**Instructions:**
1. ALWAYS respond with valid JSON only.
2. Use ONLY the summary and sample data provided.
3. When writing Python code, use only safe pandas operations on the 'df' variable.

**Available Actions:**
- "answer": Direct answer
- "code": Write Python code to analyze/transform the dataframe
- "visualize": Create a data visualization (args: title, type, xAxisKey, yAxisKey)
- "clarify": Ask for clarification

**Response Format Examples:**
{{"action": "answer", "content": "The average is 42."}}
{{"action": "code", "content": "df['new_col'] = df['old_col'] * 2", "explanation": "Doubling values"}}
{{"action": "visualize", "title": "Sales", "type": "bar", "xAxisKey": "month", "yAxisKey": "sales"}}
{{"action": "clarify", "content": "Which column?"}}

**Now provide your response as JSON:**"""
        return prompt

    def upload(self, state: AgentState, file_content: bytes) -> AgentState:
        try:
            logger.info("Processing file upload")
            df = pd.read_csv(io.StringIO(file_content.decode("utf-8")))
            
            state.raw_id = store.write_df(df)
            state.work_id = state.raw_id
            state.user_message = f"Loaded {len(df):,} rows × {len(df.columns)} columns"
            state.next_node = "eda"
            return state
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            state.error = f"Upload failed: {str(e)}"
            state.next_node = "human_input"
            return state

    def eda(self, state: AgentState) -> AgentState:
        state.next_node = "human_input"
        return state

    def undo(self, state: AgentState) -> AgentState:
        logger.info("Undo operation")
        state.user_message = state.undo()
        state.next_node = "eda"
        return state

    def export(self, state: AgentState) -> AgentState:
        try:
            logger.info(f"Exporting to {state.export_filename}")
            df = store.get_df(state.work_id)
            df.to_csv(state.export_filename, index=False)
            state.user_message = f"✅ Saved {state.export_filename}"
        except Exception as e:
            logger.error(f"Export failed: {e}")
            state.user_message = f"Export failed: {e}"
        state.next_node = "human_input"
        return state

    def execute(self, state: AgentState) -> AgentState:
        if self.llm is None:
            state.error = "LLM not initialized."
            state.user_message = state.error
            state.next_node = "human_input"
            return state

        prompt = self.build_prompt(state)
        res = None
        
        # Cache check
        if settings.enable_cache:
            cache_key = llm_cache._generate_key(prompt)
            res = llm_cache.get(cache_key)
            if res: logger.info("Using cached LLM response")

        if res is None:
            try:
                logger.info("Invoking LLM...")
                raw = self.llm.invoke([HumanMessage(content=prompt)]).content.strip()
                
                m = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.S) or re.search(r'(\{.*?\})', raw, re.S)
                if m:
                    res = json.loads(m.group(1))
                else:
                    res = {"action": "answer", "content": raw}
                
                if settings.enable_cache:
                    llm_cache.set(cache_key, res, ttl=settings.cache_ttl_seconds)
            except Exception as e:
                logger.error(f"LLM error: {e}")
                state.error = f"LLM Error: {str(e)}"
                state.retry_count += 1
                if state.retry_count < state.MAX_RETRIES:
                    state.next_node = "execute"
                    state.user_message = f"Connecting to AI... (Retry {state.retry_count})"
                else:
                    state.next_node = "human_input"
                    state.user_message = f"AI Connection Failed: {str(e)}"
                    state.retry_count = 0
                return state

        try:
            action = res.get("action")
            content = res.get("content", "")
            
            if action == "answer":
                state.user_message = content
                state.error = None
                state.retry_count = 0
                state.next_node = "human_input"
                
            elif action == "clarify":
                state.user_message = content
                state.error = None
                state.retry_count = 0
                state.next_node = "human_input"
                
            elif action == "visualize":
                state.last_tool = {
                    "name": "generateVisualization",
                    "args": {
                        "title": res.get("title", "Chart"),
                        "type": res.get("type", "bar"),
                        "xAxisKey": res.get("xAxisKey", ""),
                        "yAxisKey": res.get("yAxisKey", "")
                    }
                }
                state.user_message = "Generating visualization..."
                state.next_node = "eda"
                
            elif action == "code":
                state.last_tool = {
                    "name": "runPythonAnalysis",
                    "args": {"script": content, "explanation": res.get("explanation", "")}
                }
                state.push_undo(f"Code: {content[:60]}...")
                df = store.get_df(state.work_id)
                new_df, err, stdout = exec_code(content, df)
                
                if err:
                    state.error = err
                    state.retry_count += 1
                    state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
                else:
                    state.work_id = store.write_df(new_df)
                    diff = compare_dataframes(df, new_df)
                    msg = "✅ Code executed successfully"
                    if diff: msg += f"\n\n### Data Changes\n{diff}"
                    if stdout: msg += f"\n\n**Output:**\n```\n{stdout}\n```"
                    state.user_message = msg
                    state.error = None
                    state.retry_count = 0
                    state.next_node = "eda"
            else:
                raise ValueError(f"Unknown action: {action}")
                
        except Exception as e:
            logger.error(f"Execution node error: {e}")
            state.error = str(e)
            state.retry_count += 1
            state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
            
        return state

    def run_cycle(self, state: AgentState) -> AgentState:
        """Run the agent cycle until human input is needed."""
        safety = 0
        while state.next_node != "human_input" and safety < 20:
            if state.next_node == "execute":
                state = self.execute(state)
            elif state.next_node == "eda":
                state = self.eda(state)
            elif state.next_node == "undo":
                state = self.undo(state)
            elif state.next_node == "export":
                state = self.export(state)
            else:
                break
            safety += 1
        return state

# Global instance
agent_service = AgentService()
