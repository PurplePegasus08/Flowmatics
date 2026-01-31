"""
Disk-based storage for datasets with automatic cleanup.
Replaces in-memory storage for better scalability.
"""
import io
import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List
import pandas as pd


class DiskStore:
    """
    Disk-based storage for dataframes with metadata tracking.
    """
    
    def __init__(self, base_path: str = "./data_store"):
        """
        Initialize disk storage.
        
        Args:
            base_path: Base directory for storing data files
        """
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        
    def write_df(self, df: pd.DataFrame) -> str:
        """
        Write dataframe to disk and return unique key.
        
        Args:
            df: DataFrame to store
        
        Returns:
            Unique key for the stored dataframe
        """
        key = str(uuid.uuid4())
        
        # Write dataframe as pickle (reliable and no extra deps)
        data_path = self.base_path / f"{key}.pkl"
        df.to_pickle(data_path)
        
        # Write metadata
        metadata = {
            "key": key,
            "created_at": datetime.now().isoformat(),
            "rows": len(df),
            "columns": len(df.columns),
            "size_bytes": data_path.stat().st_size,
            "column_names": list(df.columns)
        }
        
        meta_path = self.base_path / f"{key}.meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2))
        
        return key
    
    def get_df(self, key: str) -> pd.DataFrame:
        """
        Retrieve dataframe from disk by key.
        
        Args:
            key: Unique key for the dataframe
        
        Returns:
            Stored dataframe
        
        Raises:
            FileNotFoundError: If key doesn't exist
        """
        data_path = self.base_path / f"{key}.pkl"
        
        if not data_path.exists():
            raise FileNotFoundError(f"No data found for key: {key}")
        
        return pd.read_pickle(data_path)
    
    def get_metadata(self, key: str) -> Optional[dict]:
        """
        Get metadata for a stored dataframe.
        
        Args:
            key: Unique key for the dataframe
        
        Returns:
            Metadata dictionary or None if not found
        """
        meta_path = self.base_path / f"{key}.meta.json"
        
        if not meta_path.exists():
            return None
        
        return json.loads(meta_path.read_text())
    
    def delete(self, key: str) -> bool:
        """
        Delete a stored dataframe and its metadata.
        
        Args:
            key: Unique key for the dataframe
        
        Returns:
            True if deleted, False if not found
        """
        data_path = self.base_path / f"{key}.pkl"
        meta_path = self.base_path / f"{key}.meta.json"
        
        deleted = False
        
        if data_path.exists():
            data_path.unlink()
            deleted = True
        
        if meta_path.exists():
            meta_path.unlink()
            deleted = True
        
        return deleted
    
    def cleanup_old_sessions(self, max_age_hours: int = 24) -> int:
        """
        Remove stored dataframes older than max_age_hours.
        
        Args:
            max_age_hours: Maximum age in hours
        
        Returns:
            Number of sessions cleaned up
        """
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        cleaned = 0
        
        for meta_file in self.base_path.glob("*.meta.json"):
            try:
                metadata = json.loads(meta_file.read_text())
                created = datetime.fromisoformat(metadata['created_at'])
                
                if created < cutoff:
                    key = metadata['key']
                    if self.delete(key):
                        cleaned += 1
            except Exception:
                # If we can't parse metadata, skip it
                continue
        
        return cleaned
    
    def list_all_keys(self) -> List[str]:
        """
        List all stored dataframe keys.
        
        Returns:
            List of all keys
        """
        keys = []
        for meta_file in self.base_path.glob("*.meta.json"):
            try:
                metadata = json.loads(meta_file.read_text())
                keys.append(metadata['key'])
            except Exception:
                continue
        
        return keys
    
    def get_total_size_mb(self) -> float:
        """
        Get total storage size in megabytes.
        
        Returns:
            Total size in MB
        """
        total_bytes = sum(
            f.stat().st_size 
            for f in self.base_path.glob("*.pkl")
        )
        return total_bytes / (1024 * 1024)
    
    def get_stats(self) -> dict:
        """
        Get storage statistics.
        
        Returns:
            Dictionary with storage stats
        """
        keys = self.list_all_keys()
        
        return {
            "total_sessions": len(keys),
            "total_size_mb": round(self.get_total_size_mb(), 2),
            "storage_path": str(self.base_path.absolute())
        }
