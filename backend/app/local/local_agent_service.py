import json
import re
from typing import AsyncGenerator, Dict, Any
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage

from app.core.config import settings
from app.core.logger import get_logger
from app.models.agent_state import AgentState
from app.core.storage import DiskStore
from app.services.execution_service import exec_code, compare_dataframes
from app.services.base_agent import BaseAgentService
from app.local.ollama_client import OllamaClient

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

class LocalAgentService(BaseAgentService):
    def __init__(self, ollama_url: str = None, model: str = None):
        base_url = ollama_url or settings.ollama_base_url
        model_name = model or settings.ollama_model
        
        self.client = OllamaClient(base_url=base_url, model=model_name)
        self.llm = ChatOllama(
            model=model_name,
            base_url=base_url,
            temperature=0.7,
            format="json",
            timeout=120
        )

    def is_available(self) -> bool:
        return self.client.is_available()

    def execute(self, state: AgentState) -> AgentState:
        if not self.is_available():
            state.error = "Ollama not available."
            state.next_node = "human_input"
            return state

        prompt = self.build_prompt(state)
        try:
            # LangChain handles the invoke and internal parsing if format="json" is respected by the model
            raw_response = self.llm.invoke([HumanMessage(content=prompt)])
            text = raw_response.content.strip()
            
            # Robust JSON extraction as a fallback
            m = re.search(r'```json\s*(\{.*?\})\s*```', text, re.S) or re.search(r'(\{.*?\})', text, re.S)
            if m:
                res = json.loads(m.group(1))
            else:
                res = {"action": "answer", "content": text}
                
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            state.error = f"Local LLM Error: {str(e)}"
            state.retry_count += 1
            state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
            return state

        try:
            action = res.get("action")
            content = res.get("content", "")
            reasoning = res.get("reasoning", "")
            
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
                from app.services.auto_clean_service import auto_clean_service
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
                from app.services.feature_engineer_service import feature_engineer_service
                new_df, report = feature_engineer_service.prepare_for_ml(df)
                state.work_id = store.write_df(new_df)
                diff = compare_dataframes(df, new_df)
                
                report_md = "\n".join([f"- **{r['action']}** on `{r.get('column', 'Dataset')}`: {r['reason']}" for r in report])
                state.user_message = reasoning_md + f"✅ ML Preparation complete!\n\nDataset is now fully numeric and scaled, ready for training.\n\n### Engineering Logic\n{report_md}\n\n### Data Changes\n{diff}"
                state.error, state.retry_count = None, 0
                state.next_node = "human_input"
        except Exception as e:
            logger.error(f"Local execution error: {e}")
            state.error = str(e)
            state.retry_count += 1
            state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
        return state

    async def stream_execute(self, state: AgentState):
        if not self.is_available():
            yield {"type": "error", "text": "Ollama not available."}
            return

        prompt = self.build_prompt(state)
        full_text = ""
        
        try:
            # Using ChatOllama's stream method
            async for chunk in self.llm.astream([HumanMessage(content=prompt)]):
                content = chunk.content
                full_text += content
                yield {"type": "chunk", "text": content}
            
            # After stream completes, parse final JSON for tools
            m = re.search(r'```json\s*(\{.*?\})\s*```', full_text, re.S) or re.search(r'(\{.*?\})', full_text, re.S)
            if m:
                res = json.loads(m.group(1))
            else:
                res = {"action": "answer", "content": full_text}
                
            yield {"type": "final", "res": res}
            
        except Exception as e:
            logger.error(f"Local streaming error: {e}")
            yield {"type": "error", "text": str(e)}

local_agent_service = LocalAgentService()

