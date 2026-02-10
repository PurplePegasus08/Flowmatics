import requests
import json

BASE_URL = "http://localhost:8000"

def test_full_flow():
    # 1. Upload
    print("Uploading test data...")
    csv_content = "col1,col2,col3\n1,2,3\n4,5,6"
    files = {'file': ('test.csv', csv_content, 'text/csv')}
    r = requests.post(f"{BASE_URL}/api/upload", files=files)
    if r.status_code != 200:
        print(f"Upload failed: {r.text}")
        return
    
    session_id = r.json()['sessionId']
    print(f"Session started: {session_id}")

    # 2. Chat
    print("\nSending chat message...")
    url = f"{BASE_URL}/api/chat"
    payload = {
        "history": [
            {
                "role": "user",
                "parts": [{"text": "Hello, describe the data"}]
            }
        ],
        "sessionId": session_id
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Chat Status Code: {response.status_code}")
        print(f"Chat Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Chat Error: {e}")

if __name__ == "__main__":
    test_full_flow()
