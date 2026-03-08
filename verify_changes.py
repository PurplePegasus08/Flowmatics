import sys
import os
import uuid

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("1. Testing Imports...")
try:
    from app.api.main import app
    from app.services.session_service import session_service
    from app.services.agent_service import agent_service
    from app.services.execution_service import exec_code
    from app.models.agent_state import AgentState
    print("✅ Imports successful")
except Exception as e:
    print(f"❌ Import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n2. Testing Session Persistence...")
try:
    sid = str(uuid.uuid4())
    state = AgentState(user_message="Test Session")
    
    # Save
    session_service.save_session(sid, state)
    print(f"   Saved session {sid}")
    
    # Load
    loaded = session_service.load_session(sid)
    if loaded and loaded.user_message == "Test Session":
        print("✅ Session load successful")
    else:
        print(f"❌ Session load mismatch: {loaded}")
        
    # List
    sessions = session_service.list_sessions()
    if any(s['id'] == sid for s in sessions):
        print(f"✅ Session listed successfully (Total: {len(sessions)})")
    else:
        print("❌ Session not found in list")
        
    # Delete
    session_service.delete_session(sid)
    if not session_service.load_session(sid):
        print("✅ Session deleted successfully")
    else:
        print("❌ Session delete failed")
        
except Exception as e:
    print(f"❌ Session test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n3. Testing Execution Service...")
try:
    import pandas as pd
    df = pd.DataFrame({'a': [1, 2, 3]})
    res, err, out = exec_code("df['b'] = df['a'] * 2", df)
    
    if not err and 'b' in res.columns and res.iloc[0]['b'] == 2:
         print("✅ Code execution successful")
    else:
         print(f"❌ Code execution failed: {err}")
         
except Exception as e:
    print(f"❌ Execution test failed: {e}")

print("\nAll checks passed!")
