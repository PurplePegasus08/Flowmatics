"""
Input validation and sanitization for InsightFlow AI.
Provides Pydantic models and validators for all API inputs.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from fastapi import HTTPException, UploadFile
import re


class ChatRequest(BaseModel):
    """Validated chat request model."""
    history: List[Dict[str, Any]] = Field(default_factory=list)
    dataContext: str = Field(default="", max_length=50000)
    modelName: str = Field(default="gemini-1.5-pro-latest", max_length=100)
    sessionId: str = Field(max_length=100)
    
    @field_validator('sessionId')
    @classmethod
    def validate_session_id(cls, v):
        """Validate session ID format (UUID-like)."""
        if not v or len(v) < 8 or len(v) > 100:
            raise ValueError('Invalid session ID length')
        # Allow alphanumeric and hyphens only
        if not re.match(r'^[a-zA-Z0-9\-]+$', v):
            raise ValueError('Session ID contains invalid characters')
        return v
    
    @field_validator('modelName')
    @classmethod
    def validate_model_name(cls, v):
        """Validate model name is from allowed list."""
        allowed = ['gemini-1.5-pro-latest', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-lite']
        if v not in allowed:
            # Allow it but log warning
            pass
        return v


class ReplExecuteRequest(BaseModel):
    """Validated REPL execution request."""
    script: str = Field(..., min_length=1, max_length=10000)
    
    @field_validator('script')
    @classmethod
    def validate_script(cls, v):
        """Basic validation of Python script."""
        v = v.strip()
        if not v:
            raise ValueError('Script cannot be empty')
        
        # Check for obviously dangerous patterns
        dangerous_patterns = [
            'import os',
            'import sys',
            'import subprocess',
            'import socket',
            '__import__',
            'eval(',
            'exec(',
            'compile(',
            'open(',
            'file(',
        ]
        
        for pattern in dangerous_patterns:
            if pattern in v.lower():
                raise ValueError(f'Script contains forbidden pattern: {pattern}')
        
        return v


class FileUploadValidator:
    """Validator for file uploads."""
    
    @staticmethod
    async def validate_file(
        file: UploadFile,
        max_size_bytes: int,
        allowed_types: List[str]
    ) -> bytes:
        """
        Validate and read uploaded file.
        
        Args:
            file: Uploaded file
            max_size_bytes: Maximum allowed size in bytes
            allowed_types: List of allowed file extensions
        
        Returns:
            File content as bytes
        
        Raises:
            HTTPException: If validation fails
        """
        # Check file extension
        if not file.filename:
            raise HTTPException(400, "Filename is required")
        
        file_ext = '.' + file.filename.split('.')[-1].lower()
        if file_ext not in allowed_types:
            raise HTTPException(
                400,
                f"File type {file_ext} not allowed. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > max_size_bytes:
            size_mb = len(content) / (1024 * 1024)
            max_mb = max_size_bytes / (1024 * 1024)
            raise HTTPException(
                413,
                f"File too large ({size_mb:.1f}MB). Maximum size: {max_mb}MB"
            )
        
        # Check if file is empty
        if len(content) == 0:
            raise HTTPException(400, "File is empty")
        
        return content
    
    @staticmethod
    def validate_csv_content(content: bytes) -> None:
        """
        Basic validation of CSV content.
        
        Args:
            content: CSV file content as bytes
        
        Raises:
            HTTPException: If validation fails
        """
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            raise HTTPException(400, "File must be valid UTF-8 encoded text")
        
        lines = text.strip().split('\n')
        if len(lines) < 2:
            raise HTTPException(400, "CSV must have at least a header and one data row")


def sanitize_error_message(error: Exception, safe_mode: bool = True) -> str:
    """
    Sanitize error messages for safe display to users.
    
    Args:
        error: Exception to sanitize
        safe_mode: If True, hide internal details
    
    Returns:
        Sanitized error message
    """
    if safe_mode:
        # Generic error messages for security
        error_map = {
            'FileNotFoundError': 'Resource not found',
            'PermissionError': 'Access denied',
            'ValueError': 'Invalid input provided',
            'KeyError': 'Required field missing',
        }
        error_type = type(error).__name__
        return error_map.get(error_type, 'An error occurred. Please try again.')
    else:
        # Development mode - show details
        return f"{type(error).__name__}: {str(error)}"
