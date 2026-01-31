"""
FastAPI application with improved security, validation, and error handling.
"""
import asyncio
import uuid
import io
import json
from typing import Dict
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Body, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Import backend modules
from backend import (
    build_graph, eda_node, execute_node, undo_node, export_node, upload_node,
    AgentState, store, get_stats, exec_code
)
from config import settings
from logger import get_logger
from validators import ChatRequest, ReplExecuteRequest, FileUploadValidator, sanitize_error_message

# Setup logging
logger = get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="InsightFlow AI API - Reloaded",
    description="AI-powered data analysis workspace",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Session storage
sessions_meta: Dict[str, str] = {}  # session_id -> work_id
sessions_state: Dict[str, AgentState] = {}
sessions: Dict[str, asyncio.Queue[str]] = {}

# Configure CORS with environment-based origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

logger.info(f"CORS configured with origins: {settings.allowed_origins}")


# Background task for session cleanup
async def cleanup_old_sessions():
    """Background task to clean up old sessions."""
    try:
        cleaned = store.cleanup_old_sessions(max_age_hours=settings.session_ttl_hours)
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} old sessions")
    except Exception as e:
        logger.error(f"Session cleanup error: {e}")


@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    logger.info("Starting InsightFlow AI API...")
    logger.info(f"Storage path: {settings.data_store_path}")
    logger.info(f"Max file size: {settings.max_file_size_mb}MB")
    
    # Run initial cleanup
    await cleanup_old_sessions()


@app.post("/api/upload", summary="Upload dataset", tags=["Data Management"])
async def upload(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Upload a CSV or JSON file for analysis.
    
    - **file**: CSV or JSON file (max size defined in config)
    
    Returns session ID and preview data.
    """
    logger.info(f"Upload request: {file.filename} ({file.content_type})")
    
    try:
        # Validate file
        content = await FileUploadValidator.validate_file(
            file,
            max_size_bytes=settings.max_file_size_bytes,
            allowed_types=settings.allowed_file_types
        )
        
        # Additional CSV validation
        if file.filename.endswith('.csv'):
            FileUploadValidator.validate_csv_content(content)
        
        # Process upload
        state = AgentState()
        state = upload_node(state, content)
        
        # Create session
        session_id = str(uuid.uuid4())
        sessions[session_id] = asyncio.Queue()
        sessions_meta[session_id] = state.work_id
        sessions_state[session_id] = state
        
        if state.error:
            logger.error(f"Upload processing failed: {state.error}")
            raise HTTPException(500, state.error)
            
        logger.info(f"Upload successful: session={session_id}, rows={len(store.get_df(state.work_id))}")
        
        # Build preview
        try:
            df = store.get_df(state.work_id)
            df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            preview_rows = df_safe.head(200).to_dict(orient='records')
            total_rows = len(df)
        except Exception as e:
            logger.warning(f"Preview generation failed: {e}")
            preview_rows = []
            total_rows = 0
        
        # Schedule cleanup in background
        if background_tasks:
            background_tasks.add_task(cleanup_old_sessions)
        
        return {
            "sessionId": session_id,
            "shape": f"{total_rows} rows × {len(df.columns)} columns",
            "preview": preview_rows,
            "stats": state.user_message,
            "totalRows": total_rows
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(500, sanitize_error_message(e, safe_mode=True))


@app.get('/api/preview/{session_id}', summary="Get data preview", tags=["Data Management"])
async def preview(session_id: str, limit: int = 200):
    """
    Get preview of uploaded data.
    
    - **session_id**: Session identifier
    - **limit**: Number of rows to return (max 1000)
    """
    if session_id not in sessions_meta:
        raise HTTPException(404, "Session not found")
    
    if limit > 1000:
        limit = 1000
    
    try:
        df = store.get_df(sessions_meta[session_id])
        df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        if limit <= 0 or limit >= len(df_safe):
            rows = df_safe.to_dict(orient='records')
        else:
            rows = df_safe.head(limit).to_dict(orient='records')
        
        logger.debug(f"Preview generated: session={session_id}, rows={len(rows)}")
        return {"rows": rows}
        
    except Exception as e:
        logger.error(f"Preview error: {e}")
        return {"rows": [], "error": sanitize_error_message(e)}


@app.get('/api/health', summary="Health check", tags=["System"])
async def health():
    """Check API health status."""
    storage_stats = store.get_stats()
    
    return {
        "status": "ok",
        "storage": storage_stats,
        "sessions": len(sessions_meta),
        "config": {
            "max_file_size_mb": settings.max_file_size_mb,
            "session_ttl_hours": settings.session_ttl_hours,
        }
    }


@app.get('/api/download/{session_id}', summary="Download dataset", tags=["Data Management"])
async def download_csv(session_id: str):
    """
    Download processed dataset as CSV.
    
    - **session_id**: Session identifier
    """
    if session_id not in sessions_meta:
        logger.warning(f"Download failed: session {session_id} not found")
        raise HTTPException(404, "Session not found")
    
    try:
        df = store.get_df(sessions_meta[session_id])
        df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        buf = io.StringIO()
        df_safe.to_csv(buf, index=False)
        buf.seek(0)
        
        headers = {
            "Content-Disposition": f"attachment; filename=insightflow_data_{session_id[:8]}.csv"
        }
        
        logger.info(f"Download: session={session_id}")
        return StreamingResponse(buf, media_type='text/csv', headers=headers)
        
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.post('/api/repl/{session_id}', summary="Execute Python code", tags=["Analysis"])
async def repl_execute(session_id: str, payload: dict = Body(...)):
    """
    Execute Python script in sandboxed environment.
    
    - **session_id**: Session identifier
    - **payload**: {"script": "python code"}
    """
    logger.info(f"REPL request: session={session_id}")
    
    if not session_id or session_id not in sessions_meta:
        raise HTTPException(404, "Session not found")
    
    try:
        # Validate request
        request = ReplExecuteRequest(**payload)
        script = request.script
        
        state = sessions_state.get(session_id)
        if not state or not state.work_id:
            raise HTTPException(400, "No active session or data")
        
        # Execute code
        df = store.get_df(state.work_id)
        new_df, err, stdout = exec_code(script, df)
        
        if err:
            logger.warning(f"REPL execution failed: {err}")
            return {"type": "error", "text": err}
        
        # Save result
        state.push_undo(f"REPL: {script[:60]}...")
        new_key = store.write_df(new_df)
        state.work_id = new_key
        sessions_state[session_id] = state
        sessions_meta[session_id] = new_key
        
        # Prepare response
        df_safe = new_df.replace({np.nan: None, np.inf: None, -np.inf: None})
        sample = df_safe.head(5).to_dict(orient='records')
        
        msg = "✅ Code executed successfully"
        if stdout:
            msg += f"\n\nOutput:\n{stdout}"
        
        logger.info(f"REPL success: session={session_id}")
        return {
            "type": "repl",
            "text": msg,
            "sample": sample,
            "stats": get_stats(state.work_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"REPL error: {e}", exc_info=True)
        return {"type": "error", "text": sanitize_error_message(e)}


@app.post('/api/chat', summary="Chat with AI assistant", tags=["AI"])
async def chat_endpoint(payload: dict = Body(...)):
    """
    Chat with AI assistant for data analysis.
    
    Request body:
    ```json
    {
        "history": [...],
        "dataContext": "...",
        "modelName": "...",
        "sessionId": "..."
    }
    ```
    
    Response:
    ```json
    {
        "text": "AI response",
        "functionCalls": [...]
    }
    ```
    """
    try:
        # Validate request
        request = ChatRequest(**payload)
        session_id = request.sessionId
        
        logger.info(f"Chat request: session={session_id}")
        
        # Extract user message from history
        history = request.history
        if not history:
            raise HTTPException(400, "No input provided")
        
        last_msg = history[-1]
        text = ""
        if last_msg.get("parts"):
            text = last_msg["parts"][0].get("text", "")
        
        if not text:
            raise HTTPException(400, "Empty message")
        
        logger.debug(f"User message: {text[:100]}...")
        
        # Restore or create state
        state = sessions_state.get(session_id) or AgentState()
        
        # Sync history
        state.chat_history = history
        
        if not state.work_id:
            work_id = sessions_meta.get(session_id, "")
            if work_id:
                state.work_id = work_id
                # Only set stats if we don't have a specific user request context
                if not text:
                    state.user_message = get_stats(work_id)
        
        state.next_node = "human_input"
        
        # Parse special commands
        if text.lower() in ("undo", "/undo"):
            state.user_message = "Undo requested"
            state.next_node = "undo"
        elif text.lower().startswith("/export"):
            parts = text.split()
            if len(parts) > 1:
                state.export_filename = parts[1]
            state.next_node = "export"
        else:
            state.user_message = text
            state.next_node = "execute"
        
        # Process nodes
        tool = None
        safety = 0
        while state.next_node != "human_input" and safety < 20:
            if state.next_node == "execute":
                state = execute_node(state)
                if state.last_tool:
                    tool = state.last_tool
            elif state.next_node == "eda":
                state = eda_node(state)
            elif state.next_node == "undo":
                state = undo_node(state)
            elif state.next_node == "export":
                state = export_node(state)
            else:
                break
            safety += 1
        
        # Persist state
        sessions_state[session_id] = state
        
        resp = {"text": state.user_message, "functionCalls": []}
        if tool:
            resp["functionCalls"] = [tool]
        
        logger.info(f"Chat response generated: session={session_id}")
        return resp
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        return {
            "text": f"An error occurred: {sanitize_error_message(e, safe_mode=True)}",
            "functionCalls": []
        }


@app.delete('/api/session/{session_id}', summary="Delete session", tags=["Data Management"])
async def delete_session(session_id: str):
    """
    Delete a session and its associated data.
    
    - **session_id**: Session identifier
    """
    logger.info(f"Delete session: {session_id}")
    
    try:
        # Remove from sessions
        work_id = sessions_meta.pop(session_id, None)
        sessions_state.pop(session_id, None)
        sessions.pop(session_id, None)
        
        # Delete stored data
        if work_id:
            store.delete(work_id)
        
        return {"status": "deleted", "sessionId": session_id}
        
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower()
    )
