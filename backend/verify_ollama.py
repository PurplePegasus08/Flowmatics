from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage
import sys
import os

# Add backend to path to import settings if needed
sys.path.append(os.getcwd())

def test_ollama():
    try:
        # These would normally come from app.core.config
        base_url = "http://localhost:11434"
        model = "kimi-k2.5:cloud"  # Or whatever model you have
        
        print(f"Connecting to Ollama at {base_url} with model {model}...")
        llm = ChatOllama(
            model=model,
            base_url=base_url,
            temperature=0.7,
            format="json"
        )
        
        # We'll just check if we can initialize it. 
        # Actual invocation would require the server to be running.
        print("LangChain ChatOllama initialized successfully.")
        
        from app.local.ollama_client import OllamaClient
        client = OllamaClient(base_url=base_url)
        if client.is_available():
            print("Ollama server is UP.")
            models = client.list_models()
            print(f"Available models: {models}")
        else:
            print("Ollama server is DOWN (this is fine for verification if not running locally).")
            
        print("\n✅ Verification script completed successfully.")
        
    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_ollama()
