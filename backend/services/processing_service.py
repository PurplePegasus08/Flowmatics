import pandas as pd
import numpy as np
from typing import List, Optional, Union
from logger import get_logger

logger = get_logger()

class ProcessingService:
    """
    Service for structured data processing: Cleaning, Filtering, Feature Engineering.
    """

    def impute_missing(self, df: pd.DataFrame, columns: List[str], strategy: str, fill_value: Optional[str] = None) -> pd.DataFrame:
        """
        Impute missing values in specified columns.
        Strategies: 'mean', 'median', 'mode', 'drop', 'constant'
        """
        try:
            df_new = df.copy()
            for col in columns:
                if col not in df_new.columns:
                    continue
                
                if strategy == 'drop':
                    df_new.dropna(subset=[col], inplace=True)
                elif strategy == 'mean' and pd.api.types.is_numeric_dtype(df_new[col]):
                    df_new[col] = df_new[col].fillna(df_new[col].mean())
                elif strategy == 'median' and pd.api.types.is_numeric_dtype(df_new[col]):
                    df_new[col] = df_new[col].fillna(df_new[col].median())
                elif strategy == 'mode':
                    if not df_new[col].mode().empty:
                        df_new[col] = df_new[col].fillna(df_new[col].mode()[0])
                elif strategy == 'constant':
                     df_new[col] = df_new[col].fillna(fill_value if fill_value is not None else "Unknown")
            
            return df_new
        except Exception as e:
            logger.error(f"Imputation error: {e}")
            raise

    def remove_duplicates(self, df: pd.DataFrame, subset: Optional[List[str]] = None) -> pd.DataFrame:
        """Remove duplicate rows."""
        return df.drop_duplicates(subset=subset)

    def filter_outliers(self, df: pd.DataFrame, column: str, method: str = 'iqr', threshold: float = 1.5) -> pd.DataFrame:
        """
        Remove outliers from a numeric column.
        """
        if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
            return df

        if method == 'iqr':
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - (threshold * IQR)
            upper_bound = Q3 + (threshold * IQR)
            return df[(df[column] >= lower_bound) & (df[column] <= upper_bound)]
            
        elif method == 'zscore':
            mean = df[column].mean()
            std = df[column].std()
            if std == 0: return df
            z_scores = (df[column] - mean) / std
            return df[abs(z_scores) < (threshold if threshold > 0 else 3)]

        return df

    def normalize_data(self, df: pd.DataFrame, columns: List[str], method: str = 'minmax') -> pd.DataFrame:
        """
        Scale numerical columns.
        Methods: 'minmax', 'standard'
        """
        df_new = df.copy()
        for col in columns:
            if col not in df_new.columns or not pd.api.types.is_numeric_dtype(df_new[col]):
                continue
                
            if method == 'minmax':
                min_val = df_new[col].min()
                max_val = df_new[col].max()
                if max_val != min_val:
                    df_new[col] = (df_new[col] - min_val) / (max_val - min_val)
            elif method == 'standard':
                mean = df_new[col].mean()
                std = df_new[col].std()
                if std != 0:
                    df_new[col] = (df_new[col] - mean) / std
                    
        return df_new

    def encode_categorical(self, df: pd.DataFrame, columns: List[str], method: str = 'onehot') -> pd.DataFrame:
        """
        Encode categorical columns.
        Methods: 'onehot', 'label'
        """
        df_new = df.copy()
        if method == 'onehot':
            return pd.get_dummies(df_new, columns=columns, prefix=columns)
        elif method == 'label':
            for col in columns:
                if col in df_new.columns:
                    df_new[col] = df_new[col].astype('category').cat.codes
        return df_new

processing_service = ProcessingService()
