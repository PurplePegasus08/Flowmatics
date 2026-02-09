import io
import signal
import sys
from contextlib import redirect_stdout, contextmanager
from typing import Tuple, Optional, Any, Dict
import pandas as pd
import numpy as np
import sklearn
from sklearn import preprocessing, linear_model, cluster, metrics, decomposition, ensemble, manifold

from config import settings
from logger import get_logger

logger = get_logger()

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
    import platform
    if platform.system() != 'Windows':
        signal.signal(signal.SIGALRM, signal_handler)
        signal.alarm(seconds)
        try:
            yield
        finally:
            signal.alarm(0)
    else:
        # For Windows, just yield without timeout (or use threading approach if critical)
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

def validate_code(code: str) -> Tuple[bool, str]:
    """
    Validate Python code before execution.
    Returns: (is_valid, error_message)
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

def exec_code(code: str, df: pd.DataFrame) -> Tuple[pd.DataFrame, Optional[str], str]:
    """
    Execute Python code with security constraints.
    Returns: (result_df, error_message, stdout_output)
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
            
    # Content changes
    try:
        if df_old.shape == df_new.shape and list(df_old.columns) == list(df_new.columns):
            if len(df_old) > 10000:
                 changes.append("*(Data too large for detailed cell-by-cell comparison)*")
            else:
                try:
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
                        if not changes:
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
