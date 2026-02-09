"""
DEPRECATED: This file is kept compatibility.
Please use services/ directory for new development.

- Agent Logic: services/agent_service.py
- Execution: services/execution_service.py
- Sessions: services/session_service.py
"""
from services.agent_service import agent_service, AgentService
from services.execution_service import exec_code, validate_code
from services.session_service import session_service, SessionService
from models import AgentState

# Re-export for any lingering imports
__all__ = ['agent_service', 'exec_code', 'session_service', 'AgentState']