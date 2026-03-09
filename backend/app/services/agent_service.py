from typing import Any
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
import re
import json

from app.core.config import settings
from app.core.logger import get_logger
from app.models.agent_state import AgentState
from app.core.storage import DiskStore
from app.core.cache import llm_cache
from app.services.execution_service import exec_code, compare_dataframes
from app.services.base_agent import BaseAgentService
from app.services.auto_clean_service import auto_clean_service
from app.services.feature_engineer_service import feature_engineer_service

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

class AgentService(BaseAgentService):
    def __init__(self):
        self.llm = self._init_llm()

    def _init_llm(self):
        try:
            return ChatGoogleGenerativeAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                google_api_key=settings.api_key,
                timeout=settings.llm_timeout_seconds
            )
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            return None

    def execute(self, state: AgentState) -> AgentState:
        if self.llm is None:
            state.error = "LLM not initialized."
            state.next_node = "human_input"
            return state

        prompt = self.build_prompt(state)
        res = None
        if settings.enable_cache:
            res = llm_cache.get(llm_cache._generate_key(prompt))

        if res is None:
            try:
                raw = self.llm.invoke([HumanMessage(content=prompt)]).content.strip()
                m = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.S) or re.search(r'(\{.*?\})', raw, re.S)
                res = json.loads(m.group(1)) if m else {"action": "answer", "content": raw}
                if settings.enable_cache:
                    llm_cache.set(llm_cache._generate_key(prompt), res, ttl=settings.cache_ttl_seconds)
            except Exception as e:
                logger.error(f"LLM error: {e}")
                state.error = f"LLM Error: {str(e)}"
                state.retry_count += 1
                state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
                return state

        try:
            action = res.get("action")
            content = res.get("content", "")
            reasoning = res.get("reasoning", "")
            
            # Incorporate reasoning into the user message for transparency if requested
            reasoning_md = f"> [!TIP]\n> **AI Reasoning:** {reasoning}\n\n" if reasoning else ""

            if action in ("answer", "clarify"):
                state.user_message = reasoning_md + content
                state.error, state.retry_count = None, 0
                state.next_node = "human_input"
            elif action == "visualize":
                state.last_tool = {"name": "generateVisualization", "args": {k: res.get(k, "") for k in ["title", "type", "xAxisKey", "yAxisKey"]}}
                state.user_message = reasoning_md + "Generating visualization..."
                state.next_node = "human_input"
            elif action == "code":
                state.last_tool = {"name": "runPythonAnalysis", "args": {"script": content, "explanation": res.get("explanation", "")}}
                self.push_undo(state, f"Code: {content[:60]}...")
                df = store.get_df(state.work_id)
                new_df, err, stdout = exec_code(content, df)
                if err:
                    state.error = err
                    state.retry_count += 1
                    state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
                else:
                    state.work_id = store.write_df(new_df)
                    diff = compare_dataframes(df, new_df)
                    state.user_message = reasoning_md + f"✅ Code executed successfully\n\n### Data Changes\n{diff}" + (f"\n\n**Output:**\n```\n{stdout}\n```" if stdout else "")
                    state.error, state.retry_count = None, 0
                    state.next_node = "human_input"
            elif action == "auto_clean":
                state.last_tool = {"name": "autoCleanData", "args": {}}
                df = store.get_df(state.work_id)
                self.push_undo(state, "Smart Auto-Clean")
                new_df, report = auto_clean_service.auto_prepare(df)
                state.work_id = store.write_df(new_df)
                diff = compare_dataframes(df, new_df)
                
                report_md = "\n".join([f"- **{r['action']}** on `{r.get('column', r.get('columns'))}`: {r['reason']}" for r in report])
                state.user_message = reasoning_md + f"✅ Smart Auto-Clean complete!\n\nI've automatically improved data quality based on statistical profiling.\n\n### Reasoning Log\n{report_md}\n\n### Data Changes\n{diff}"
                state.error, state.retry_count = None, 0
                state.next_node = "human_input"
            elif action == "prepare_for_ml":
                state.last_tool = {"name": "prepareForML", "args": {}}
                df = store.get_df(state.work_id)
                self.push_undo(state, "Prepare for ML")
                new_df, report = feature_engineer_service.prepare_for_ml(df)
                state.work_id = store.write_df(new_df)
                diff = compare_dataframes(df, new_df)
                
                report_md = "\n".join([f"- **{r['action']}** on `{r.get('column', 'Dataset')}`: {r['reason']}" for r in report])
                state.user_message = f"✅ ML Preparation complete!\n\nDataset is now fully numeric and scaled, ready for training.\n\n### Engineering Logic\n{report_md}\n\n### Data Changes\n{diff}"
                state.error, state.retry_count = None, 0
                state.next_node = "human_input"
        except Exception as e:
            logger.error(f"Execution node error: {e}")
            state.error = str(e)
            state.retry_count += 1
            state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
    async def stream_execute(self, state: AgentState):
        if self.llm is None:
            yield {"type": "error", "text": "LLM not initialized."}
            return

        prompt = self.build_prompt(state)
        full_text = ""
        
        try:
            async for chunk in self.llm.astream([HumanMessage(content=prompt)]):
                content = chunk.content
                full_text += content
                yield {"type": "chunk", "text": content}
            
            m = re.search(r'```json\s*(\{.*?\})\s*```', full_text, re.S) or re.search(r'(\{.*?\})', full_text, re.S)
            res = json.loads(m.group(1)) if m else {"action": "answer", "content": full_text}
            yield {"type": "final", "res": res}
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield {"type": "error", "text": str(e)}


agent_service = AgentService()
