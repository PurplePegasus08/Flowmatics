import os
import json
import time
from typing import Dict, List, Optional
from models import AgentState
from config import settings
from logger import get_logger

logger = get_logger()

class SessionService:
    def __init__(self):
        self.sessions_dir = os.path.join(settings.data_store_path, "sessions")
        os.makedirs(self.sessions_dir, exist_ok=True)
        self.index_path = os.path.join(self.sessions_dir, "index.json")
        self._ensure_index()

    def _get_path(self, session_id: str) -> str:
        return os.path.join(self.sessions_dir, f"{session_id}.json")

    def _ensure_index(self):
        """Ensure index file exists."""
        if not os.path.exists(self.index_path):
            self._rebuild_index()

    def _load_index(self) -> Dict[str, Dict]:
        try:
            if not os.path.exists(self.index_path):
                return {}
            with open(self.index_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load session index: {e}")
            return {}

    def _save_index(self, index: Dict[str, Dict]):
        try:
            with open(self.index_path, 'w') as f:
                json.dump(index, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save session index: {e}")

    def _rebuild_index(self):
        """Rebuild index from existing files."""
        logger.info("Rebuilding session index...")
        index = {}
        if os.path.exists(self.sessions_dir):
            for filename in os.listdir(self.sessions_dir):
                if filename.endswith(".json") and filename != "index.json":
                    sid = filename[:-5]
                    try:
                        path = self._get_path(sid)
                        with open(path, 'r') as f:
                            data = json.load(f)
                        
                        index[sid] = {
                            "id": sid,
                            "work_id": data.get('work_id', ''),
                            "title": (data.get('user_message', '') or "New Session")[:50],
                            "timestamp": os.path.getmtime(path)
                        }
                    except Exception as e:
                        logger.warning(f"Skipping corrupt session {sid}: {e}")
        self._save_index(index)

    def _update_index(self, session_id: str, state: AgentState):
        """Update a single entry in the index."""
        try:
            index = self._load_index()
            index[session_id] = {
                "id": session_id,
                "work_id": state.work_id,
                "title": (state.user_message or "New Session")[:50],
                "timestamp": time.time()
            }
            self._save_index(index)
        except Exception as e:
            logger.error(f"Failed to update index for {session_id}: {e}")

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
            
            # Update index
            self._update_index(session_id, state)
            
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
        
        # Remove from index
        try:
            index = self._load_index()
            if session_id in index:
                del index[session_id]
                self._save_index(index)
        except Exception as e:
            logger.error(f"Failed to update index after delete {session_id}: {e}")

    def list_sessions(self) -> List[Dict]:
        """List all available sessions with metadata."""
        # Check if index exists, if not rebuild
        if not os.path.exists(self.index_path):
            self._rebuild_index()
            
        index = self._load_index()
        sessions = list(index.values())
        
        # Sort by timestamp desc
        sessions.sort(key=lambda x: x['timestamp'], reverse=True)
        return sessions

# Global instance
session_service = SessionService()
