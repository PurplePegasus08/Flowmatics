"""
FastAPI application with improved security, validation, and error handling.
Refactored to use modular services.
"""
import uuid
import io
import json
import asyncio
import numpy as np
from typing import Dict, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Body, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, StreamingResponse

# Import new services
from app.core.config import settings
from app.core.logger import get_logger
from app.core.validators import ChatRequest, ReplExecuteRequest, FileUploadValidator, sanitize_error_message
from app.models.agent_state import AgentState
from app.core.storage import DiskStore

from app.services.session_service import session_service
from app.services.agent_service import agent_service
from app.services.execution_service import exec_code, compare_dataframes
from app.services.processing_service import processing_service
from app.services.dashboard_service import dashboard_service
from app.services.llm_dashboard_service import llm_dashboard_service
from app.services.auto_clean_service import auto_clean_service
from app.services.insight_engine import insight_engine
from app.services.feature_engineer_service import feature_engineer_service
from app.services.reproducibility_service import reproducibility_service
from app.local.model_router import get_agent_service, get_provider_status

# Setup logging
logger = get_logger()
store = DiskStore(base_path=settings.data_store_path)


async def cleanup_old_sessions():
    """Background task to clean up old sessions."""
    try:
        cleaned = store.cleanup_old_sessions(max_age_hours=settings.session_ttl_hours)
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} old sessions")
    except Exception as e:
        logger.error(f"Session cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown tasks."""
    logger.info("Starting InsightFlow AI API (v2)...")
    logger.info(f"Storage path: {settings.data_store_path}")
    logger.info(f"Max file size: {settings.max_file_size_mb}MB")
    
    # Run initial cleanup
    await cleanup_old_sessions()
    
    yield
    
    logger.info("Shutting down InsightFlow AI API...")

# Initialize FastAPI app
app = FastAPI(
    title="InsightFlow AI API - Reloaded",
    description="AI-powered data analysis workspace",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS - relaxed for development
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS configured with origins: {settings.allowed_origins}")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": sanitize_error_message(exc.detail, safe_mode=True)}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": sanitize_error_message(exc, safe_mode=True)}
    )


@app.post("/api/upload", summary="Upload dataset", tags=["Data Management"])
async def upload(
    file: UploadFile = File(...),
    description: str = Body(""),
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
        state = agent_service.upload(state, content, file.filename, description)
        
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
            preview_rows = store.sanitize_df(df).head(200).to_dict(orient='records')
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
            "shape": f"{total_rows} rows" + (f" × {len(df.columns)} columns" if 'df' in locals() else ""),
            "preview": preview_rows,
            "stats": state.user_message,
            "totalRows": total_rows,
            "description": state.dataset_description
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(500, sanitize_error_message(e, safe_mode=True))


@app.get('/api/preview/{session_id}', summary="Get data preview", tags=["Data Management"])
async def preview(session_id: str, limit: int = 1000):
    """Get preview of uploaded data."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
    
    if limit > 1000: limit = 1000
    
    try:
        df_safe = store.sanitize_df(store.get_df(state.work_id))
        
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

@app.get('/api/settings/llm', summary="Get LLM provider status", tags=["Settings"])
async def get_llm_status():
    """Get current LLM provider status and available providers."""
    return get_provider_status()

@app.put('/api/settings/llm/provider', summary="Switch LLM provider", tags=["Settings"])
async def switch_llm_provider(payload: dict = Body(...)):
    """Switch between Gemini and Ollama providers."""
    try:
        provider = payload.get('provider', 'gemini')
        if provider not in ['gemini', 'ollama']:
            raise HTTPException(400, "Provider must be 'gemini' or 'ollama'")
        
        # Update global settings (runtime only, not persisted to .env)
        settings.llm_provider = provider
        logger.info(f"Switched LLM provider to: {provider}")
        
        return {"status": "success", "provider": provider, "providers": get_provider_status()}
    except Exception as e:
        logger.error(f"Provider switch error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.post('/api/chat/stream', summary="Stream AI Chat", tags=["Agent"])
async def chat_stream(req: ChatRequest):
    """
    Stream AI responses using Server-Sent Events (SSE).
    """
    service = get_agent_service(req.provider)
    state = session_service.load_session(req.sessionId)
    if not state:
        raise HTTPException(404, "Session not found")
    state.user_message = req.message
    # Optional context updates
    # ...

    async def event_generator():
        async for chunk_data in service.stream_execute(state):
            # Format as SSE
            yield f"data: {json.dumps(chunk_data)}\n\n"
            # Introduce slight pacing for natural feel
            if chunk_data.get("type") == "chunk":
                await asyncio.sleep(0.02)
        
        # PERSIST STATE after stream finishes (in case actions updated state.work_id)
        session_service.save_session(req.sessionId, state)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


def get_stats_local(wid):
    """Helper to get dataframe info string."""
    try:
        from app.core.storage import DiskStore
        from app.core.config import settings
        store = DiskStore(base_path=settings.data_store_path)
        d = store.get_df(wid)
        buf = io.StringIO()
        d.info(buf=buf)
        return buf.getvalue()
    except Exception:
        return ""


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
        agent_service.push_undo(state, f"REPL: {script[:60]}...")
        new_key = store.write_df(new_df)
        state.work_id = new_key
        
        # PERSIST STATE
        session_service.save_session(session_id, state)
        
        # Prepare response
        sample = store.sanitize_df(new_df).head(200).to_dict(orient='records')
        diff = compare_dataframes(df, new_df)
        
        msg = f"✅ Code executed successfully\n\n### Data Changes\n{diff}"
        if stdout:
            msg += f"\n\n**Output:**\n```\n{stdout}\n```"
        
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


# --- New Processing Endpoints ---

@app.post("/api/process/{action}/{session_id}", summary="Process data", tags=["Processing"])
async def process_data(action: str, session_id: str, payload: dict = Body(...)):
    """
    Apply structured processing to the dataset.
    Actions: impute, filter, feature_engineer
    """
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")

    try:
        df = store.get_df(state.work_id)
        new_df = df
        
        cols = payload.get("columns", [])
        
        # Dispatch based on action
        if action == "impute":
            strategy = payload.get("strategy", "mean")
            fill_value = payload.get("fillValue")
            agent_service.push_undo(state, f"Impute {strategy} on {cols}")
            new_df = processing_service.impute_missing(df, cols, strategy, fill_value)
            
        elif action == "remove_duplicates":
            agent_service.push_undo(state, "Remove Duplicates")
            new_df = processing_service.remove_duplicates(df, cols if cols else None)
            
        elif action == "filter_outliers":
            method = payload.get("method", "iqr")
            threshold = float(payload.get("threshold", 1.5))
            col = cols[0] if cols else None
            if col:
                agent_service.push_undo(state, f"Filter outliers ({method}) on {col}")
                new_df = processing_service.filter_outliers(df, col, method, threshold)
                
        elif action == "normalize":
            method = payload.get("method", "minmax")
            agent_service.push_undo(state, f"Normalize ({method}) on {cols}")
            new_df = processing_service.normalize_data(df, cols, method)
            
        elif action == "encode":
            method = payload.get("method", "onehot")
            agent_service.push_undo(state, f"Encode ({method}) on {cols}")
            new_df = processing_service.encode_categorical(df, cols, method)
            
        elif action == "auto_clean":
            agent_service.push_undo(state, "Smart Auto-Clean")
            new_df, report = auto_clean_service.auto_prepare(df)
            state.transformation_report.extend(report)
            
            use_pca = payload.get("usePca", False)
            new_df, report = feature_engineer_service.prepare_for_ml(df, use_pca=use_pca)
            state.transformation_report.extend(report)
            
        elif action == "rename_column":
            old_name = payload.get("oldName")
            new_name = payload.get("newName")
            agent_service.push_undo(state, f"Rename {old_name} to {new_name}")
            new_df = processing_service.rename_column(df, old_name, new_name)
            
        elif action == "delete_column":
            col = payload.get("column")
            agent_service.push_undo(state, f"Delete column {col}")
            new_df = processing_service.delete_column(df, col)
            
        elif action == "cast_type":
            col = payload.get("column")
            target = payload.get("targetType")
            agent_service.push_undo(state, f"Cast {col} to {target}")
            new_df = processing_service.cast_type(df, col, target)
            
        elif action == "calculate_column":
            new_name = payload.get("newName")
            expr = payload.get("expression")
            agent_service.push_undo(state, f"Calculate {new_name} = {expr}")
            new_df = processing_service.calculate_column(df, new_name, expr)
            
        else:
            raise HTTPException(400, f"Unknown action: {action}")

        # Save result
        if new_df is not df:
            new_key = store.write_df(new_df)
            state.work_id = new_key
            session_service.save_session(session_id, state)
            
        return {
            "status": "success",
            "rows": len(new_df),
            "columns": len(new_df.columns),
            "sample": store.sanitize_df(new_df).head(200).to_dict(orient='records'),
            "report": report if 'report' in locals() else []
        }

    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.post("/api/undo/{session_id}", summary="Undo last operation", tags=["Processing"])
async def undo_operation(session_id: str):
    """Revert the last dataset transformation."""
    state = session_service.load_session(session_id)
    if not state:
        raise HTTPException(404, "Session not found")
        
    try:
        # Agent service has undo logic built-in to handle pop/push
        state.next_node = "undo"
        active_agent = get_agent_service()
        state = active_agent.run_cycle(state)
        
        # Save state
        session_service.save_session(session_id, state)
        
        # Get new preview
        df = store.get_df(state.work_id)
        return {
            "status": "success",
            "message": "Step reverted",
            "rows": len(df),
            "sample": store.sanitize_df(df).head(200).to_dict(orient='records')
        }
    except Exception as e:
        logger.error(f"Undo error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.get("/api/dashboard/generate/{session_id}", summary="Generate dashboard", tags=["Dashboard"])
async def generate_dashboard(session_id: str):
    """Generate suggested dashboard configuration."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
        
    try:
        df = store.get_df(state.work_id)
        charts = dashboard_service.generate_dashboard(df)
        return {"charts": charts}
    except Exception as e:
        logger.error(f"Dashboard gen error: {e}")
        raise HTTPException(500, sanitize_error_message(e))


@app.post("/api/dashboard/plotly/{session_id}", summary="Generate LLM Plotly dashboard", tags=["Dashboard"])
async def generate_plotly_dashboard(session_id: str):
    """
    Ask the LLM to generate a complete, self-contained Plotly.js HTML dashboard
    tailored to the uploaded dataset. Returns {'html': '<full html string>'}.
    """
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")

    try:
        df = store.get_df(state.work_id)
        html = llm_dashboard_service.generate(df)
        return {"html": html}
    except Exception as e:
        logger.error(f"Plotly dashboard gen error: {e}", exc_info=True)
        raise HTTPException(500, sanitize_error_message(e))


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
        if request.persona:
            state.persona = request.persona
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
        
        # RUN AGENT CYCLE - Use model router
        active_agent = get_agent_service()
        state = active_agent.run_cycle(state)
        
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

@app.get('/api/insights/summary/{session_id}', summary="Generate executive summary", tags=["AI Insights"])
async def generate_summary(session_id: str):
    """Generate 3-bullet AI executive summary of the dataset."""
    try:
        state = session_service.load_session(session_id)
        if not state or not state.work_id:
            raise HTTPException(404, "Session not found or no data loaded")
        
        # Get data stats
        df = store.get_df(state.work_id)
        stats_summary = f"Dataset with {len(df)} rows and {len(df.columns)} columns"
        
        # Generate summary using agent
        original_msg = state.user_message
        state.user_message = f"Provide exactly 3 bullet points summarizing the most important insights from this dataset: {stats_summary}. Be concise and actionable."
        state.persona = "Analyst"  # Use Analyst persona for summaries
        state.next_node = "execute"
        
        # Run agent - Use model router
        active_agent = get_agent_service()
        result_state = active_agent.run_cycle(state)
        
        # Parse response
        summary_text = result_state.user_message or "No insights available"
        
        # Extract bullet points
        lines = [l.strip() for l in summary_text.split('\n') if l.strip()]
        insights = [l.lstrip('•-*123456789. ') for l in lines if l and not l.startswith('{')][:3]
        
        # Restore original state
        state.user_message = original_msg
        
        return {"insights": insights if len(insights) > 0 else ["Data analysis complete", "Multiple dimensions detected", "Ready for visualization"]}
    except Exception as e:
        logger.error(f"Summary generation error: {e}")
        raise HTTPException(500, sanitize_error_message(e))

@app.get('/api/insights/proactive/{session_id}', summary="Get proactive insights", tags=["AI Insights"])
async def get_proactive_insights(session_id: str):
    """Get automatically discovered patterns and anomalies."""
    state = session_service.load_session(session_id)
    if not state or not state.work_id:
        raise HTTPException(404, "Session not found")
        
    try:
        df = store.get_df(state.work_id)
        insights = insight_engine.get_quick_insights(df)
        return {"insights": insights}
    except Exception as e:
        logger.error(f"Proactive insights error: {e}")
        raise HTTPException(500, sanitize_error_message(e))

@app.put('/api/session/{session_id}/description', summary="Update dataset description", tags=["Data Management"])
async def update_description(session_id: str, payload: dict = Body(...)):
    """Update the dataset goal/description for better AI context."""
    state = session_service.load_session(session_id)
    if not state:
        raise HTTPException(404, "Session not found")
    
    description = payload.get("description", "")
    state.dataset_description = description
    session_service.save_session(session_id, state)
    
    return {"status": "success", "description": description}

@app.get('/api/reproducibility/export/{session_id}', summary="Export cleaning script", tags=["Data Management"])
async def export_reproducibility_script(session_id: str):
    """Generate and export a Python script that replicates all dataset transformations."""
    state = session_service.load_session(session_id)
    if not state:
        raise HTTPException(404, "Session not found")
        
    try:
        script = reproducibility_service.generate_script(state.transformation_report)
        buf = io.StringIO()
        buf.write(script)
        buf.seek(0)
        
        headers = {
            "Content-Disposition": f"attachment; filename=reproduce_cleaning_{session_id[:8]}.py"
        }
        
        return StreamingResponse(buf, media_type='text/x-python', headers=headers)
    except Exception as e:
        logger.error(f"Script export error: {e}")
        raise HTTPException(500, sanitize_error_message(e))

@app.put('/api/session/{session_id}/rename', summary="Rename session", tags=["Data Management"])
async def rename_session(session_id: str, payload: dict = Body(...)):
    """Rename a session."""
    new_title = payload.get("title")
    if not new_title:
        raise HTTPException(400, "Title is required")
        
    try:
        session_service.rename_session(session_id, new_title)
        return {"status": "renamed", "sessionId": session_id, "title": new_title}
    except Exception as e:
        logger.error(f"Rename session error: {e}")
        raise HTTPException(500, sanitize_error_message(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower()
    )
