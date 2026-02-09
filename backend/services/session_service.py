import os
import json
from typing import Dict, List, Optional
from models import AgentState
from config import settings
from logger import get_logger

logger = get_logger()

class SessionService:
    def __init__(self):
        self.sessions_dir = os.path.join(settings.data_store_path, "sessions")
        os.makedirs(self.sessions_dir, exist_ok=True)

    def _get_path(self, session_id: str) -> str:
        return os.path.join(self.sessions_dir, f"{session_id}.json")

    def save_session(self, session_id: str, state: AgentState):
        """Save session state to disk."""
        try:
            path = self._get_path(session_id)
            with open(path, 'w') as f:
                # Pydantic v1/v2 compatibility: try usage
                if hasattr(state, 'model_dump_json'):
                    f.write(state.model_dump_json())
                else:
                    f.write(state.json())
        except Exception as e:
            logger.error(f"Failed to save session {session_id}: {e}")
            raise

    def load_session(self, session_id: str) -> Optional[AgentState]:
        """Load session state from disk."""
        path = self._get_path(session_id)
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            return AgentState(**data)
        except Exception as e:
            logger.error(f"Failed to load session {session_id}: {e}")
            return None

    def delete_session(self, session_id: str):
        """Delete session file."""
        path = self._get_path(session_id)
        if os.path.exists(path):
            os.remove(path)

    def list_sessions(self) -> List[Dict]:
        """List all available sessions with metadata."""
        sessions = []
        if not os.path.exists(self.sessions_dir): 
            return []
            
        for filename in os.listdir(self.sessions_dir):
            if filename.endswith(".json"):
                sid = filename[:-5]
                try:
                    # Optimizing: Read just stats if possible, but loading whole json is safer for now
                    # For performance in production, separate metadata file is better.
                    # Here we load state.
                    path = self._get_path(sid)
                    with open(path, 'r') as f:
                        data = json.load(f)
                    
                    # Extract fields manually to avoid validation overhead if unnecessary
                    work_id = data.get('work_id', '')
                    user_msg = data.get('user_message', '')
                    
                    sessions.append({
                        "id": sid,
                        "work_id": work_id,
                        "title": user_msg[:30] + "..." if user_msg else "New Session",
                        "timestamp": os.path.getmtime(path)
                    })
                except Exception as e:
                    logger.warning(f"Skipping currupt session {sid}: {e}")
                    
        # Sort by timestamp desc
        sessions.sort(key=lambda x: x['timestamp'], reverse=True)
        return sessions

# Global instance
session_service = SessionService()
