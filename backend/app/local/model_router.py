"""
Model Router - Dynamically selects between Gemini (cloud) and Ollama (local) LLM providers.
"""
from enum import Enum
from typing import Union
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger()


class LLMProvider(str, Enum):
    """Available LLM providers."""
    GEMINI = "gemini"
    OLLAMA = "ollama"


def get_agent_service(provider: str = None):
    """
    Factory function to get the appropriate agent service.
    
    Args:
        provider: 'gemini' or 'ollama'. Defaults to config setting.
    
    Returns:
        Agent service instance (either AgentService or LocalAgentService)
    """
    provider_name = provider or settings.llm_provider
    
    try:
        provider_enum = LLMProvider(provider_name.lower())
    except ValueError:
        logger.warning(f"Unknown provider '{provider_name}', defaulting to Gemini")
        provider_enum = LLMProvider.GEMINI
    
    if provider_enum == LLMProvider.OLLAMA:
        logger.info("Using Ollama (local) LLM provider")
        from app.local.local_agent_service import local_agent_service
        
        # Check if Ollama is available
        if not local_agent_service.is_available():
            logger.warning("Ollama not available, falling back to Gemini")
            from app.services.agent_service import agent_service
            return agent_service
        
        return local_agent_service
    
    else:  # GEMINI
        logger.info("Using Gemini (cloud) LLM provider")
        from app.services.agent_service import agent_service
        return agent_service


def get_provider_status() -> dict:
    """
    Get status of all available providers.
    
    Returns:
        Dict with provider availability and active provider info
    """
    from app.services.agent_service import agent_service
    from app.local.local_agent_service import local_agent_service
    
    return {
        "active_provider": settings.llm_provider,
        "providers": {
            "gemini": {
                "available": True,  # Assume always available if API key set
                "model": "gemini-1.5-pro-latest"
            },
            "ollama": {
                "available": local_agent_service.is_available(),
                "model": settings.ollama_model,
                "url": settings.ollama_base_url
            }
        }
    }
