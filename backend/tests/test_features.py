
import sys
import os

# Add current directory to path so we can import backend modules
sys.path.append(os.getcwd())

import pandas as pd
import numpy as np

# Mocking config/settings if needed, but allow import to fail naturally if env vars missing
try:
    from backend import compare_dataframes, exec_code
except ImportError as e:
    print(f"Import failed: {e}")
    # Try importing directly to check syntax
    import backend
    sys.exit(1)

print("--- Testing Compare Dataframes ---")
df1 = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
df2 = pd.DataFrame({'A': [1, 99, 3], 'B': [4, 5, 6]}) # Changed 2->99
diff = compare_dataframes(df1, df2)
print(f"Diff Output:\n{diff}")

assert "Values Changed" in diff
assert "99" in diff, "Diff should show the new value"
print("Diff Test PASSED")

print("\n--- Testing Sklearn Execution ---")
# Use df2 as input
code = """
import numpy as np
from sklearn.preprocessing import StandardScaler
df['C'] = [10, 20, 30]
scaler = StandardScaler()
df['C_scaled'] = scaler.fit_transform(df[['C']])
"""

new_df, err, out = exec_code(code, df2)

if err:
    print(f"Execution Error: {err}")
    print(f"Output: {out}")
    sys.exit(1)

print("Execution Output:", out)
print("Result Columns:", new_df.columns)

assert 'C_scaled' in new_df.columns
print("Sklearn Test PASSED")
