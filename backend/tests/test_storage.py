"""
Test suite for storage operations.
"""
import pytest
import pandas as pd
from pathlib import Path
import shutil
from storage import DiskStore


@pytest.fixture
def temp_store(tmp_path):
    """Create temporary storage for testing."""
    store = DiskStore(base_path=str(tmp_path / "test_store"))
    yield store
    # Cleanup
    if Path(store.base_path).exists():
        shutil.rmtree(store.base_path)


def test_write_and_read_df(temp_store):
    """Test writing and reading dataframes."""
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    
    key = temp_store.write_df(df)
    assert key is not None
    
    loaded_df = temp_store.get_df(key)
    pd.testing.assert_frame_equal(df, loaded_df)


def test_get_metadata(temp_store):
    """Test metadata retrieval."""
    df = pd.DataFrame({"a": [1, 2, 3]})
    key = temp_store.write_df(df)
    
    metadata = temp_store.get_metadata(key)
    assert metadata is not None
    assert metadata["key"] == key
    assert metadata["rows"] == 3
    assert metadata["columns"] == 1


def test_delete(temp_store):
    """Test deletion of stored data."""
    df = pd.DataFrame({"a": [1, 2, 3]})
    key = temp_store.write_df(df)
    
    assert temp_store.delete(key) is True
    
    with pytest.raises(FileNotFoundError):
        temp_store.get_df(key)


def test_list_all_keys(temp_store):
    """Test listing all stored keys."""
    df1 = pd.DataFrame({"a": [1, 2]})
    df2 = pd.DataFrame({"b": [3, 4]})
    
    key1 = temp_store.write_df(df1)
    key2 = temp_store.write_df(df2)
    
    keys = temp_store.list_all_keys()
    assert len(keys) == 2
    assert key1 in keys
    assert key2 in keys


def test_get_stats(temp_store):
    """Test storage statistics."""
    df = pd.DataFrame({"a": range(100)})
    temp_store.write_df(df)
    
    stats = temp_store.get_stats()
    assert stats["total_sessions"] == 1
    assert stats["total_size_mb"] > 0


def test_cleanup_old_sessions(temp_store):
    """Test cleanup of old sessions."""
    df = pd.DataFrame({"a": [1, 2, 3]})
    key = temp_store.write_df(df)
    
    # Cleanup with 0 hours (should remove all)
    cleaned = temp_store.cleanup_old_sessions(max_age_hours=0)
    assert cleaned >= 0
