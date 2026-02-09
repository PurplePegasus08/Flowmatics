from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field
from logger import get_logger
from storage import DiskStore
from config import settings

logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

class UndoEntry(BaseModel):
    description: str
    snapshot_key: str

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
