"""
Ollama HTTP Client wrapper for local LLM processing.
Provides interface to Ollama server running on localhost:11434
"""
import json
import requests
from typing import Dict, Any, Optional, List
from app.core.logger import get_logger

logger = get_logger()


class OllamaClient:
    """Client for communicating with Ollama API."""
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3"):
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout = 120  # Longer timeout for local inference
    
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
    
    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        format: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate completion from Ollama.
        
        Args:
            prompt: User prompt
            system: System prompt
            temperature: Sampling temperature
            format: Response format ('json' for structured output)
        
        Returns:
            Dict with 'text' and optionally 'metadata'
        """
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                }
            }
            
            if system:
                payload["system"] = system
            
            if format == "json":
                payload["format"] = "json"
            
            logger.debug(f"Ollama request to model: {self.model}")
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code} - {response.text}")
            
            try:
                # Some models might return empty or fragmented responses if misconfigured
                response_text = response.text.strip()
                if not response_text:
                    raise Exception(f"Ollama returned an empty response for model '{self.model}'.")
                
                result = response.json()
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Ollama JSON. Response text: {response.text[:200]}")
                # Check if it was a 200 OK but with error content (happens with some proxies)
                if "error" in response.text.lower():
                     raise Exception(f"Ollama returned an error message instead of JSON: {response.text[:100]}")
                raise Exception(f"Failed to parse Ollama JSON response. Most likely model '{self.model}' is not valid or endpoint is incorrect.")
            
            return {
                "text": result.get("response", ""),
                "metadata": {
                    "model": self.model,
                    "total_duration": result.get("total_duration", 0),
                    "load_duration": result.get("load_duration", 0),
                    "prompt_eval_count": result.get("prompt_eval_count", 0),
                    "eval_count": result.get("eval_count", 0)
                }
            }
            
        except requests.Timeout:
            raise Exception(f"Ollama request timed out after {self.timeout}s")
        except requests.RequestException as e:
            raise Exception(f"Ollama connection failed: {str(e)}. Is Ollama running?")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse Ollama response: {e}")
    
    def stream_generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.7,
        format: Optional[str] = None
    ):
        """
        Stream generation from Ollama.
        """
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": True,
                "options": {"temperature": temperature}
            }
            if system: payload["system"] = system
            if format == "json": payload["format"] = "json"

            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout,
                stream=True
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama stream error: {response.status_code}")

            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if not chunk.get("done"):
                        yield chunk.get("response", "")
                    else:
                        yield ""  # End of stream marker if needed
                        
        except Exception as e:
            logger.error(f"Ollama stream failed: {e}")
            raise Exception(f"Ollama stream failed: {str(e)}")

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        format: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Chat completion using Ollama chat API.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature
            format: Response format ('json' for structured output)
        
        Returns:
            Dict with 'text' and 'metadata'
        """
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                }
            }
            
            if format == "json":
                payload["format"] = "json"
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")
            
            result = response.json()
            
            return {
                "text": result.get("message", {}).get("content", ""),
                "metadata": {
                    "model": self.model,
                    "done": result.get("done", False)
                }
            }
            
        except requests.RequestException as e:
            raise Exception(f"Ollama chat failed: {str(e)}")
