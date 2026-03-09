"""
Ollama connectivity client for health checks.
Generation logic is handled via langchain-ollama.
"""
import requests
from typing import List
from app.core.logger import get_logger

logger = get_logger()


class OllamaClient:
    """Client for checking Ollama API health and models."""
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3"):
        self.base_url = base_url.rstrip('/')
        self.model = model
    
    def is_available(self) -> bool:
        """Check if Ollama server is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def list_models(self) -> List[str]:
        """Get list of available models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [model['name'] for model in data.get('models', [])]
            return []
        except requests.RequestException as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

