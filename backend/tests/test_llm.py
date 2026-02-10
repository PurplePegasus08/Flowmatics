
import os
import signal
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import time

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

print(f"API Key present: {bool(api_key)}")

# Timeout handler
def handler(signum, frame):
    raise TimeoutError("Timed out!")

# Windows doesn't support signal.alarm, so we use simplified check
candidates = [
    "gemini-pro",
    "models/gemini-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]

for model in candidates:
    print(f"\nTesting model: {model}")
    try:
        llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=0,
            request_timeout=5
        )
        print("Invoking LLM...")
        res = llm.invoke([HumanMessage(content="Hi")])
        print(f"Response: {res.content}")
        print(f"[OK] LLM WORKS with {model}")
        break
    except Exception as e:
        print(f"[FAIL] FAILED with {model}: {e}")
