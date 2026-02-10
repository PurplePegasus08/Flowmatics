from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field

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
