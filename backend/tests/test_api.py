"""
Test suite for API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from api import app
import io

client = TestClient(app)


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "storage" in data
    assert "sessions" in data


def test_upload_csv():
    """Test CSV file upload."""
    csv_content = "name,age,city\nJohn,30,NYC\nJane,25,LA\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    
    response = client.post("/api/upload", files=files)
    assert response.status_code == 200
    
    data = response.json()
    assert "sessionId" in data
    assert "preview" in data
    assert len(data["preview"]) > 0


def test_upload_invalid_file_type():
    """Test upload with invalid file type."""
    txt_content = "This is a text file"
    files = {"file": ("test.txt", txt_content, "text/plain")}
    
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400


def test_upload_empty_file():
    """Test upload with empty file."""
    files = {"file": ("empty.csv", "", "text/csv")}
    
    response = client.post("/api/upload", files=files)
    assert response.status_code == 400


def test_preview_invalid_session():
    """Test preview with invalid session ID."""
    response = client.get("/api/preview/invalid-session-id")
    assert response.status_code == 404


def test_repl_execution():
    """Test REPL code execution."""
    # First upload a file
    csv_content = "value\n10\n20\n30\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    upload_response = client.post("/api/upload", files=files)
    session_id = upload_response.json()["sessionId"]
    
    # Execute code
    payload = {"script": "df['doubled'] = df['value'] * 2"}
    response = client.post(f"/api/repl/{session_id}", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] != "error"


def test_repl_dangerous_code():
    """Test REPL with dangerous code patterns."""
    # First upload a file
    csv_content = "value\n10\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    upload_response = client.post("/api/upload", files=files)
    session_id = upload_response.json()["sessionId"]
    
    # Try to execute dangerous code
    payload = {"script": "import os; os.system('ls')"}
    response = client.post(f"/api/repl/{session_id}", json=payload)
    
    data = response.json()
    assert data["type"] == "error"


def test_delete_session():
    """Test session deletion."""
    # First upload a file
    csv_content = "value\n10\n"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    upload_response = client.post("/api/upload", files=files)
    session_id = upload_response.json()["sessionId"]
    
    # Delete session
    response = client.delete(f"/api/session/{session_id}")
    assert response.status_code == 200
    
    # Verify it's deleted
    preview_response = client.get(f"/api/preview/{session_id}")
    assert preview_response.status_code == 404
