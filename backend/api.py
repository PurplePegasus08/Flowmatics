"""
FastAPI application with improved security, validation, and error handling.
Refactored to use modular services.
"""
import asyncio
import uuid
import io
import json
from typing import Dict, List
import numpy as np
import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Body, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Import new services
from config import settings
from logger import get_logger
from validators import ChatRequest, ReplExecuteRequest, FileUploadValidator, sanitize_error_message
from models import AgentState
from storage import DiskStore

from services.session_service import session_service
from services.agent_service import agent_service
from services.execution_service import exec_code

# Setup logging
logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)

# Initialize FastAPI app
app = FastAPI(
    title="InsightFlow AI API - Reloaded",
    description="AI-powered data analysis workspace",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS - relaxed for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS configured with origins: {settings.allowed_origins}")


# Background task for session cleanup (delegated to store for now, but could be in SessionService)
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
    logger.info("Starting InsightFlow AI API (v2)...")
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
        
        # Process upload via AgentService
        state = AgentState()
        state = agent_service.upload(state, content)
        
        # Create session
        session_id = str(uuid.uuid4())
        session_service.save_session(session_id, state)
        
        if state.error:
            logger.error(f"Upload processing failed: {state.error}")
            raise HTTPException(500, state.error)
            
        logger.info(f"Upload successful: session={session_id}")
        
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
    """Get preview of uploaded data."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
    
    if limit > 1000: limit = 1000
    
    try:
        df = store.get_df(state.work_id)
        df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        if limit <= 0 or limit >= len(df_safe):
            rows = df_safe.to_dict(orient='records')
        else:
            rows = df_safe.head(limit).to_dict(orient='records')
        
        return {"rows": rows}
        
    except Exception as e:
        logger.error(f"Preview error: {e}")
        return {"rows": [], "error": sanitize_error_message(e)}


@app.get('/api/health', summary="Health check", tags=["System"])
async def health():
    """Check API health status."""
    return {
        "status": "ok",
        "storage": store.get_stats(),
        "sessions": len(session_service.list_sessions()),
        "config": {
            "max_file_size_mb": settings.max_file_size_mb,
            "session_ttl_hours": settings.session_ttl_hours,
        }
    }


@app.get('/api/download/{session_id}', summary="Download dataset", tags=["Data Management"])
async def download_csv(session_id: str):
    """Download processed dataset as CSV."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
    
    try:
        df = store.get_df(state.work_id)
        df_safe = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        buf = io.StringIO()
        df_safe.to_csv(buf, index=False)
        buf.seek(0)
        
        headers = {
            "Content-Disposition": f"attachment; filename=insightflow_data_{session_id[:8]}.csv"
        }
        
        return StreamingResponse(buf, media_type='text/csv', headers=headers)
        
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.post('/api/repl/{session_id}', summary="Execute Python code", tags=["Analysis"])
async def repl_execute(session_id: str, payload: dict = Body(...)):
    """Execute Python script in sandboxed environment."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
    
    try:
        request = ReplExecuteRequest(**payload)
        script = request.script
        
        # Execute code via separate execution service
        df = store.get_df(state.work_id)
        new_df, err, stdout = exec_code(script, df)
        
        if err:
            logger.warning(f"REPL execution failed: {err}")
            return {"type": "error", "text": err}
        
        # Save result (update state)
        state.push_undo(f"REPL: {script[:60]}...")
        new_key = store.write_df(new_df)
        state.work_id = new_key
        
        # PERSIST STATE
        session_service.save_session(session_id, state)
        
        # Prepare response
        df_safe = new_df.replace({np.nan: None, np.inf: None, -np.inf: None})
        sample = df_safe.head(5).to_dict(orient='records')
        
        msg = "✅ Code executed successfully"
        if stdout:
            msg += f"\n\nOutput:\n{stdout}"
        
        # Helper logging
        def get_stats_local(wid):
            try:
                d = store.get_df(wid)
                buf = io.StringIO(); d.info(buf=buf)
                return buf.getvalue()
            except: return ""

        return {
            "type": "repl",
            "text": msg,
            "sample": sample,
            "stats": get_stats_local(state.work_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"REPL error: {e}", exc_info=True)
        return {"type": "error", "text": sanitize_error_message(e)}


@app.post('/api/chat', summary="Chat with AI assistant", tags=["AI"])
async def chat_endpoint(payload: dict = Body(...)):
    """Chat with AI assistant for data analysis."""
    try:
        request = ChatRequest(**payload)
        session_id = request.sessionId
        
        # Load state
        state = session_service.load_session(session_id)
        if not state:
            # Try to create a blank state if session ID is new (though upload usually handles this)
            if session_id == "default":
                state = AgentState()
            else:
                raise HTTPException(404, "Session not found")
        
        # Extract user message
        history = request.history
        if not history: raise HTTPException(400, "No input provided")
        
        last_msg = history[-1]
        text = ""
        if last_msg.get("parts"):
            text = last_msg["parts"][0].get("text", "")
        
        if not text: raise HTTPException(400, "Empty message")
        
        logger.debug(f"User message: {text[:100]}...")
        
        # Update state with new inputs
        state.chat_history = history
        state.next_node = "human_input"
        
        # Command parsing
        if text.lower() in ("undo", "/undo"):
            state.user_message = "Undo requested"
            state.next_node = "undo"
        elif text.lower().startswith("/export"):
            parts = text.split()
            if len(parts) > 1: state.export_filename = parts[1]
            state.next_node = "export"
        else:
            state.user_message = text
            state.next_node = "execute"
        
        # RUN AGENT CYCLE
        state = agent_service.run_cycle(state)
        
        # PERSIST STATE
        session_service.save_session(session_id, state)
        
        resp = {"text": state.user_message, "functionCalls": []}
        if state.last_tool:
            resp["functionCalls"] = [state.last_tool]
            # Clear tool after sending to avoid re-sending? 
            # Actually, agent service creates a new state object effectively in memory, 
            # we should check if we want to clear it. For now, keep as is.
        
        return resp
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        return {
            "text": f"An error occurred: {sanitize_error_message(e, safe_mode=True)}",
            "functionCalls": []
        }


@app.get('/api/session/{session_id}', summary="Get session details", tags=["Data Management"])
async def get_session(session_id: str):
    """Get full session state (history, metadata)."""
    state = session_service.load_session(session_id)
    if not state:
        raise HTTPException(404, "Session not found")
    
    return {
        "sessionId": session_id,
        "history": state.chat_history,
        "workId": state.work_id,
        "lastMessage": state.user_message
    }

@app.delete('/api/session/{session_id}', summary="Delete session", tags=["Data Management"])
async def delete_session(session_id: str):
    """Delete a session."""
    logger.info(f"Delete session: {session_id}")
    try:
        session_service.delete_session(session_id)
        return {"status": "deleted", "sessionId": session_id}
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(500, sanitize_error_message(e))

@app.get('/api/sessions', summary="List sessions", tags=["Data Management"])
async def list_sessions():
    """List all saved sessions."""
    try:
        return session_service.list_sessions()
    except Exception as e:
        logger.error(f"List sessions error: {e}")
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower()
    )
