"""
Disk-based storage for datasets with automatic cleanup and LRU caching.
"""
import io
import json
import uuid
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import pandas as pd
import numpy as np
from functools import lru_cache

class DiskStore:
    """Disk-based storage for dataframes with LRU caching."""
    
    def __init__(self, base_path: str = "./data_store"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, pd.DataFrame] = {}
        self._cache_limit = 5

    def sanitize_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize dataframe for JSON serialization."""
        return df.replace({np.nan: None, np.inf: None, -np.inf: None})

    def write_df(self, df: pd.DataFrame) -> str:
        key = str(uuid.uuid4())
        data_path = self.base_path / f"{key}.parquet"
        df.to_parquet(data_path, engine='pyarrow')
        
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
        
        # Add to cache
        self._cache[key] = df
        if len(self._cache) > self._cache_limit:
            self._cache.pop(next(iter(self._cache)))
            
        return key

    def get_df(self, key: str) -> pd.DataFrame:
        if key in self._cache:
            return self._cache[key]
            
        data_path = self.base_path / f"{key}.parquet"
        if not data_path.exists():
            raise FileNotFoundError(f"No data found for key: {key}")
        
        df = pd.read_parquet(data_path, engine='pyarrow')
        self._cache[key] = df
        return df

    def delete(self, key: str) -> bool:
        data_path = self.base_path / f"{key}.parquet"
        meta_path = self.base_path / f"{key}.meta.json"
        deleted = False
        if data_path.exists():
            data_path.unlink()
            deleted = True
        if meta_path.exists():
            meta_path.unlink()
            deleted = True
        if key in self._cache:
            del self._cache[key]
        return deleted

    def cleanup_old_sessions(self, max_age_hours: int = 24) -> int:
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        cleaned = 0
        for meta_file in self.base_path.glob("*.meta.json"):
            try:
                metadata = json.loads(meta_file.read_text())
                if datetime.fromisoformat(metadata['created_at']) < cutoff:
                    if self.delete(metadata['key']): cleaned += 1
            except: continue
        return cleaned

    def list_all_keys(self) -> List[str]:
        return [json.loads(f.read_text())['key'] for f in self.base_path.glob("*.meta.json") if f.exists()]

    def get_stats(self) -> dict:
        keys = self.list_all_keys()
        total_bytes = sum(f.stat().st_size for f in self.base_path.glob("*.parquet"))
        return {
            "total_sessions": len(keys),
            "total_size_mb": round(total_bytes / (1024 * 1024), 2),
            "storage_path": str(self.base_path.absolute()),
            "cache_size": len(self._cache)
        }
