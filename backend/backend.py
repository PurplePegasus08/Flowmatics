# backend.py – Core data processing logic with improved security and reliability
import io
import uuid
import json
import re
import signal
from typing import List, Optional, Literal, Dict, Tuple
from contextlib import redirect_stdout, contextmanager
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
import sklearn
from sklearn import preprocessing, linear_model, cluster, metrics, decomposition, ensemble, manifold

# Import new modules
from config import settings
from logger import setup_logger, get_logger
from storage import DiskStore
from cache import llm_cache

# Setup logging
logger = setup_logger(
    log_file=settings.log_file,
    log_level=settings.log_level,
    max_bytes=settings.log_max_bytes,
    backup_count=settings.log_backup_count
)

logger.info("Initializing InsightFlow AI backend...")

# ---------- Storage ----------
store = DiskStore(base_path=settings.data_store_path)
logger.info(f"Storage initialized at: {settings.data_store_path}")

# ---------- State ----------
class UndoEntry(BaseModel):
    description: str
    snapshot_key: str  # Changed to store key instead of bytes


class AgentState(BaseModel):
    raw_id: str = ""
    work_id: str = ""
    history: List[UndoEntry] = Field(default_factory=list)
    next_node: Literal["upload", "eda", "human_input", "execute", "undo", "export", "END"] = "upload"
    user_message: str = ""
    error: Optional[str] = None
    export_filename: str = "cleaned.csv"
    retry_count: int = 0
    MAX_RETRIES: int = 3
    last_tool: Optional[dict] = None
    chat_history: List[dict] = Field(default_factory=list)

    def push_undo(self, desc: str):
        """Save current state to undo history."""
        if self.work_id:
            try:
                # Create a snapshot by copying the current dataframe
                df = store.get_df(self.work_id)
                snapshot_key = store.write_df(df)
                self.history.append(UndoEntry(description=desc, snapshot_key=snapshot_key))
                logger.debug(f"Undo snapshot created: {desc}")
            except Exception as e:
                logger.error(f"Failed to create undo snapshot: {e}")

    def undo(self) -> str:
        """Restore previous state from undo history."""
        if not self.history:
            return "Nothing to undo."
        
        entry = self.history.pop()
        self.work_id = entry.snapshot_key
        logger.info(f"Undone: {entry.description}")
        return f"Undone: {entry.description}"


# ---------- LLM Initialization ----------
try:
    llm = ChatGoogleGenerativeAI(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        google_api_key=settings.api_key,
        timeout=settings.llm_timeout_seconds
    )
    logger.info(f"LLM initialized: {settings.llm_model}")
except Exception as e:
    logger.error(f"Failed to initialize LLM: {e}")
    llm = None


# ---------- Utility Functions ----------
def compute_stats(df: pd.DataFrame) -> str:
    """Compute dataset statistics."""
    buf = io.StringIO()
    df.info(buf=buf)
    missing = df.isna().sum()
    missing_str = str(missing[missing > 0]) if missing.sum() > 0 else 'None'
    
    return f"Shape: {df.shape}\nMissing:\n{missing_str}\n{buf.getvalue()}"


def get_schema_sample(work_id: str, n: int = 3) -> Tuple[List[str], List[dict]]:
    """
    Return column names and a small list of sanitized sample rows.
    Values with NaN / ±Inf are replaced with None to be JSON safe.
    """
    try:
        df = store.get_df(work_id)
        df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        cols = list(df_safe.columns)
        sample = df_safe.head(n).to_dict(orient='records')
        return cols, sample
    except Exception as e:
        logger.error(f"Error getting schema sample: {e}")
        return [], []


def get_stats(work_id: str) -> str:
    """Get statistics for a dataset."""
    if not work_id:
        return "No data."
    try:
        df = store.get_df(work_id)
        return compute_stats(df)
    except Exception as e:
        logger.error(f"Stats error for {work_id}: {e}")
        return f"Stats error: {e}"


# ---------- Secure Code Execution ----------
class TimeoutException(Exception):
    """Exception raised when code execution times out."""
    pass


@contextmanager
def time_limit(seconds: int):
    """Context manager for timing out code execution."""
    def signal_handler(signum, frame):
        raise TimeoutException("Code execution timed out")
    
    # Note: signal.alarm only works on Unix systems
    # For Windows, we'll use a different approach
    import platform
    if platform.system() != 'Windows':
        signal.signal(signal.SIGALRM, signal_handler)
        signal.alarm(seconds)
        try:
            yield
        finally:
            signal.alarm(0)
    else:
        # For Windows, just yield without timeout (or use threading approach)
        yield


SAFE_BUILTINS = {
    "len": len,
    "sum": sum,
    "min": min,
    "max": max,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "print": print,
    "sorted": sorted,
    "reversed": reversed,
    "abs": abs,
    "round": round,
    "__import__": __import__,  # Needed for import statements to work
}

# Allowed pandas operations (whitelist)
ALLOWED_DF_OPERATIONS = [
    'head', 'tail', 'describe', 'info', 'columns', 'shape', 'dtypes',
    'isna', 'notna', 'fillna', 'dropna', 'drop_duplicates',
    'sort_values', 'groupby', 'agg', 'sum', 'mean', 'median', 'std',
    'min', 'max', 'count', 'value_counts', 'unique', 'nunique',
    'rename', 'astype', 'apply', 'map', 'replace', 'query',
    'merge', 'join', 'concat', 'pivot_table', 'melt',
    'loc', 'iloc', 'at', 'iat', 'copy', 'reset_index', 'set_index',
]


def validate_code(code: str) -> Tuple[bool, str]:
    """
    Validate Python code before execution.
    
    Returns:
        (is_valid, error_message)
    """
    # Check code length
    if len(code) > settings.max_code_length:
        return False, f"Code too long (max {settings.max_code_length} characters)"
    
    # Check for dangerous patterns
    dangerous_patterns = [
        ('import os', 'OS module access not allowed'),
        ('import sys', 'System module access not allowed'),
        ('import subprocess', 'Subprocess module not allowed'),
        ('import socket', 'Network access not allowed'),
        ('__import__', 'Dynamic imports not allowed'),
        ('eval(', 'eval() not allowed'),
        ('exec(', 'exec() not allowed'),
        ('compile(', 'compile() not allowed'),
        ('open(', 'File operations not allowed'),
        ('file(', 'File operations not allowed'),
        ('input(', 'User input not allowed'),
        ('raw_input(', 'User input not allowed'),
    ]
    
    code_lower = code.lower()
    for pattern, message in dangerous_patterns:
        if pattern in code_lower:
            return False, message
    
    return True, ""


def compare_dataframes(df_old: pd.DataFrame, df_new: pd.DataFrame) -> str:
    """
    Compare two dataframes and return a markdown summary of changes.
    """
    if df_old is None:
        return "New dataframe created."
        
    changes = []
    
    # Shape change
    if df_old.shape != df_new.shape:
        changes.append(f"**Shape Change:** `{df_old.shape}` -> `{df_new.shape}`")
        diff_rows = df_new.shape[0] - df_old.shape[0]
        if diff_rows != 0:
            changes.append(f"Rows: {'+' if diff_rows > 0 else ''}{diff_rows}")
        diff_cols = df_new.shape[1] - df_old.shape[1]
        if diff_cols != 0:
            changes.append(f"Columns: {'+' if diff_cols > 0 else ''}{diff_cols}")
            
    # Content changes (if shapes match or close enough to compare)
    try:
        if df_old.shape == df_new.shape and list(df_old.columns) == list(df_new.columns):
            # Compare values
            # We align them and compare. 
            # Note: This can be expensive for large DFs, so we take a sample or limit check
            if len(df_old) > 10000:
                 changes.append("*(Data too large for detailed cell-by-cell comparison)*")
            else:
                # Create a mask of changes
                try:
                    # Fill NaNs for comparison purposes (NaN != NaN by default usually, but we want to ignore that if both are NaN)
                    # Using specific equals check or just formatting
                    ne = (df_old != df_new) & ~(df_old.isna() & df_new.isna())
                    changed_counts = ne.sum().sum()
                    
                    if changed_counts > 0:
                        changes.append(f"**Values Changed:** {changed_counts} cells modified.")
                        
                        # Show a few examples
                        diff_indices = np.where(ne)
                        examples = []
                        for i in range(min(5, len(diff_indices[0]))):
                            row_idx = diff_indices[0][i]
                            col_idx = diff_indices[1][i]
                            col_name = df_old.columns[col_idx]
                            val_old = df_old.iloc[row_idx, col_idx]
                            val_new = df_new.iloc[row_idx, col_idx]
                            examples.append(f"- Row {row_idx}, `{col_name}`: `{val_old}` -> `{val_new}`")
                        
                        if examples:
                            changes.append("\n**Sample Changes:**\n" + "\n".join(examples))
                    else:
                        if not changes: # If no shape change and no value change
                            changes.append("No changes detected.")
                except Exception as e:
                    changes.append(f"(Could not compute precise diff: {e})")
        else:
            # Columns changed
            new_cols = set(df_new.columns) - set(df_old.columns)
            removed_cols = set(df_old.columns) - set(df_new.columns)
            if new_cols:
                changes.append(f"**New Columns:** {', '.join(new_cols)}")
            if removed_cols:
                changes.append(f"**Removed Columns:** {', '.join(removed_cols)}")

    except Exception as e:
        changes.append(f"(Diff error: {e})")

    return "\n\n".join(changes)


def exec_code(code: str, df: pd.DataFrame) -> Tuple[pd.DataFrame, Optional[str], str]:
    """
    Execute Python code with security constraints.
    
    Args:
        code: Python code to execute
        df: Input dataframe
    
    Returns:
        (result_df, error_message, stdout_output)
    """
    logger.info(f"Executing code (length: {len(code)})")
    
    # Validate code
    is_valid, error_msg = validate_code(code)
    if not is_valid:
        logger.warning(f"Code validation failed: {error_msg}")
        return df, error_msg, ""
    
    output = io.StringIO()
    
    try:
        # Create safe execution environment
        safe_globals = {
            "__builtins__": SAFE_BUILTINS,
            "pd": pd,
            "np": np,
            "sklearn": sklearn,
            "preprocessing": preprocessing,
            "linear_model": linear_model,
            "cluster": cluster,
            "metrics": metrics,
            "decomposition": decomposition,
            "ensemble": ensemble,
            "manifold": manifold,
        }
        
        safe_locals = {
            "df": df.copy(),
        }
        
        # Execute with timeout
        with redirect_stdout(output):
            try:
                with time_limit(settings.code_exec_timeout_seconds):
                    exec(code, safe_globals, safe_locals)
            except TimeoutException as e:
                return df, str(e), output.getvalue()
        
        captured = output.getvalue()
        
        # Verify df still exists and is valid
        if "df" not in safe_locals:
            return df, "Code must define 'df' variable", captured
        
        result_df = safe_locals["df"]
        
        if not isinstance(result_df, pd.DataFrame):
            return df, "Variable 'df' must be a DataFrame", captured
        
        logger.info("Code executed successfully")
        return result_df, None, captured
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Code execution error: {error_msg}")
        return df, error_msg, output.getvalue()


# ---------- Enhanced Prompt Engineering ----------
def build_prompt(state: AgentState) -> str:
    """
    Build enhanced prompt with few-shot examples and better context.
    """
    err = f"\nError: {state.error}\nPlease fix the error and try again." if state.error else ""
    retry = f"\nRetry {state.retry_count + 1}/{state.MAX_RETRIES}" if state.retry_count else ""
    
    # Format chat history
    history_txt = ""
    if state.chat_history:
        history_txt = "\n**Conversation History:**\n"
        for msg in state.chat_history[-6:]: # Keep last 3 turns
            role = "User" if msg.get("role") == "user" else "Assistant"
            parts = msg.get("parts", [{"text": ""}])
            text = parts[0].get("text", "")
            history_txt += f"{role}: {text}\n"
    
    cols, sample = get_schema_sample(state.work_id, n=5)  # Increased sample size
    sample_txt = json.dumps(sample, default=str, ensure_ascii=False, indent=2)
    cols_txt = ', '.join(cols)
    
    stats = get_stats(state.work_id)
    
    prompt = f"""You are an expert data analyst AI assistant. Your role is to help users analyze, visualize, and transform their datasets.

**Current Dataset Summary:**
{stats}

**Available Columns:** {cols_txt}

**Sample Data (first 5 rows):**
{sample_txt}

{history_txt}
**User Request:** "{state.user_message}"
{err}{retry}

**Instructions:**
1. ALWAYS respond with valid JSON only (no markdown, no explanations outside JSON)
2. Use ONLY the summary and sample data provided - DO NOT request full dataset
3. When writing Python code, use only safe pandas operations on the 'df' variable
4. Be helpful, accurate, and provide clear explanations

**Available Actions:**
- "answer": Provide a direct answer to the user's question
- "code": Write Python code to analyze/transform the dataframe
- "visualize": Create a data visualization
- "clarify": Ask for clarification if the request is ambiguous

**Response Format Examples:**

For answering questions:
{{"action": "answer", "content": "Based on the data, there are 150 rows with an average age of 42.5 years."}}

For data transformation:
{{"action": "code", "content": "df = df.dropna()\\ndf['age_group'] = pd.cut(df['age'], bins=[0, 18, 65, 100], labels=['child', 'adult', 'senior'])", "explanation": "Removing missing values and creating age groups"}}

For visualization:
{{"action": "visualize", "title": "Sales by Region", "type": "bar", "xAxisKey": "region", "yAxisKey": "sales"}}

For clarification:
{{"action": "clarify", "content": "Which column would you like to analyze? Options are: {cols_txt}"}}

**Now provide your response as JSON:**

Note: You have access to `scikit-learn` (as `sklearn`) for advanced analysis.
When changing data, the system will automatically show a diff, so focus on performing the correct operations."""
    
    return prompt


# ---------- Node Functions ----------
def upload_node(state: AgentState, file_content: bytes) -> AgentState:
    """Process uploaded file."""
    try:
        logger.info("Processing file upload")
        df = pd.read_csv(io.StringIO(file_content.decode("utf-8")))
        
        state.raw_id = store.write_df(df)
        state.work_id = state.raw_id
        state.user_message = f"Loaded {len(df):,} rows × {len(df.columns)} columns"
        state.next_node = "eda"
        
        logger.info(f"Upload successful: {state.user_message}")
        return state
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        print(f"!!! UPLOAD FAILED: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        state.error = f"Upload failed: {str(e)}"
        state.next_node = "human_input"
        return state


def eda_node(state: AgentState) -> AgentState:
    """Perform exploratory data analysis."""
    logger.debug("EDA node executing")
    # Don't overwrite state.user_message here, as it might contain the AI's response
    # Instead, we just transition to human_input
    state.next_node = "human_input"
    return state


def execute_node(state: AgentState) -> AgentState:
    """Execute LLM-based data analysis."""
    if llm is None:
        state.error = "LLM not initialized. Please check your API key configuration."
        state.user_message = state.error
        state.next_node = "human_input"
        logger.error("LLM not available")
        return state
    
    prompt = build_prompt(state)
    res = None
    
    # Try cache first
    if settings.enable_cache:
        cache_key = llm_cache._generate_key(prompt)
        res = llm_cache.get(cache_key)
        if res:
            logger.info("Using cached LLM response")
            
    # If not in cache or cache disabled, call LLM
    if res is None:
        try:
            logger.info("Invoking LLM...")
            raw = llm.invoke([HumanMessage(content=prompt)]).content.strip()
            logger.debug(f"LLM response: {raw[:200]}...")
            
            # Parse JSON from response
            m = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.S) or re.search(r'(\{.*?\})', raw, re.S)
            if m:
                res = json.loads(m.group(1))
            else:
                # Fallback for non-JSON responses
                res = {"action": "answer", "content": raw}
            
            # Cache the response
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
                # CRITICAL: Set user_message to error to prevent echoing
                state.user_message = f"I'm sorry, I'm having trouble connecting to the AI service. Please check your API key and network connection. (Detail: {str(e)})"
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
            logger.info("Answer generated")
            
        elif action == "clarify":
            state.user_message = content
            state.error = None
            state.retry_count = 0
            state.next_node = "human_input"
            logger.info("Clarification requested")
            
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
            logger.info(f"Visualization created: {res.get('title')}")
            
        elif action == "code":
            # Record tool call
            state.last_tool = {
                "name": "runPythonAnalysis",
                "args": {
                    "script": content,
                    "explanation": res.get("explanation", "")
                }
            }
            
            state.push_undo(f"Code: {content[:60]}...")
            df = store.get_df(state.work_id)
            new_df, err, stdout = exec_code(content, df)
            
            if err:
                state.error = err
                state.retry_count += 1
                state.next_node = "execute" if state.retry_count < state.MAX_RETRIES else "human_input"
                logger.warning(f"Code execution failed: {err}")
            else:
                state.work_id = store.write_df(new_df)
                
                # Compute diff
                try:
                    diff = compare_dataframes(df, new_df)
                except Exception as e:
                    diff = f"Error computing diff: {e}"
                
                msg = "✅ Code executed successfully"
                
                if diff:
                    msg += f"\n\n### Data Changes\n{diff}"
                
                if stdout:
                    msg += f"\n\n**Output:**\n```\n{stdout}\n```"
                state.user_message = msg
                state.error = None
                state.retry_count = 0
                state.next_node = "eda"
                logger.info("Code executed successfully")
        else:
            raise ValueError(f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Execution node error: {e}")
        state.error = str(e)
        state.retry_count += 1
        if state.retry_count < state.MAX_RETRIES:
            state.next_node = "execute"
        else:
            state.next_node = "human_input"
            state.user_message = f"Error: {state.error}\n(Failed after {state.MAX_RETRIES} retries)"
    
    return state


def undo_node(state: AgentState) -> AgentState:
    """Undo last operation."""
    logger.info("Undo operation")
    state.user_message = state.undo()
    state.next_node = "eda"
    return state


def export_node(state: AgentState) -> AgentState:
    """Export dataset to CSV."""
    try:
        logger.info(f"Exporting to {state.export_filename}")
        df = store.get_df(state.work_id)
        df.to_csv(state.export_filename, index=False)
        state.user_message = f"✅ Saved {state.export_filename}"
        logger.info("Export successful")
    except Exception as e:
        logger.error(f"Export failed: {e}")
        state.user_message = f"Export failed: {e}"
    state.next_node = "human_input"
    return state


# ---------- Graph (kept for compatibility) ----------
def build_graph():
    """Build LangGraph workflow (kept for compatibility)."""
    from langgraph.graph import StateGraph, START, END
    
    w = StateGraph(AgentState)
    w.add_node("upload", lambda s, fc: upload_node(s, fc))
    w.add_node("eda", eda_node)
    w.add_node("execute", execute_node)
    w.add_node("undo", undo_node)
    w.add_node("export", export_node)
    w.add_edge(START, "upload")
    w.add_edge("upload", "eda")
    w.add_edge("eda", "human_input")
    w.add_edge("undo", "eda")
    w.add_edge("export", "human_input")
    w.add_conditional_edges("human_input", lambda s: s.next_node,
        {"execute": "execute", "undo": "undo", "export": "export", "END": END})
    w.add_conditional_edges("execute", lambda s: s.next_node,
        {"human_input": "human_input", "execute": "execute", "eda": "eda"})
    
    return w.compile()


logger.info("Backend initialization complete")