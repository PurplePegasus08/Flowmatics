import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from app.core.logger import get_logger

logger = get_logger()

class AutoCleanService:
    """
    Service for automated data profiling and intelligent cleansing.
    Redesigned to provide explainable reports of all actions.
    """

    def profile_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generate a detailed health profile of the dataset with advanced stats.
        """
        profile = {
            "total_rows": len(df),
            "total_cols": len(df.columns),
            "columns": {}
        }

        for col in df.columns:
            series = df[col]
            missing_count = series.isna().sum()
            unique_count = series.nunique()
            
            col_profile = {
                "dtype": str(series.dtype),
                "missing_count": int(missing_count),
                "missing_pct": float(missing_count / len(df)) * 100,
                "unique_count": int(unique_count),
                "cardinality": float(unique_count / len(df)) if len(df) > 0 else 0
            }

            if pd.api.types.is_numeric_dtype(series):
                series_clean = series.dropna()
                col_profile.update({
                    "mean": float(series_clean.mean()) if not series_clean.empty else 0,
                    "median": float(series_clean.median()) if not series_clean.empty else 0,
                    "std": float(series_clean.std()) if not series_clean.empty else 0,
                    "min": float(series_clean.min()) if not series_clean.empty else 0,
                    "max": float(series_clean.max()) if not series_clean.empty else 0,
                    "skewness": float(series_clean.skew()) if not series_clean.empty else 0,
                    "kurtosis": float(series_clean.kurtosis()) if not series_clean.empty else 0,
                    "is_outlier_prone": abs(series_clean.skew()) > 1.5 if not series_clean.empty else False
                })
            
            profile["columns"][col] = col_profile

        return profile

    def auto_prepare(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Automatically cleans data and returns (cleaned_df, report).
        """
        df_clean = df.copy()
        profile = self.profile_data(df_clean)
        report = []

        # 1. Drop highly missing columns
        cols_to_drop = [c for c, p in profile["columns"].items() if p["missing_pct"] > 90]
        if cols_to_drop:
            df_clean.drop(columns=cols_to_drop, inplace=True)
            report.append({
                "action": "drop_columns",
                "columns": cols_to_drop,
                "reason": "Missingness > 90% (too much data missing for reliable imputation)"
            })

        # 2. Impute missing values
        for col, p in profile["columns"].items():
            if col not in df_clean.columns or p["missing_count"] == 0:
                continue
            
            if pd.api.types.is_numeric_dtype(df_clean[col]):
                skew = p.get("skewness", 0)
                if abs(skew) < 1:
                    strategy = "mean"
                    df_clean[col] = df_clean[col].fillna(df_clean[col].mean())
                    reason = f"Normal distribution detected (skew={skew:.2f}). Mean is a stable central tendency."
                else:
                    strategy = "median"
                    df_clean[col] = df_clean[col].fillna(df_clean[col].median())
                    reason = f"Skewed distribution detected (skew={skew:.2f}). Median is more robust to extreme values."
                
                report.append({
                    "action": "impute",
                    "column": col,
                    "strategy": strategy,
                    "reason": reason
                })
            else:
                mode = df_clean[col].mode()
                if not mode.empty:
                    df_clean[col] = df_clean[col].fillna(mode[0])
                    report.append({
                        "action": "impute",
                        "column": col,
                        "strategy": "mode",
                        "reason": "Categorical feature; imputed using the most frequent value."
                    })
                else:
                    df_clean[col] = df_clean[col].fillna("Unknown")

        # 3. Remove duplicates
        initial_len = len(df_clean)
        df_clean.drop_duplicates(inplace=True)
        if len(df_clean) < initial_len:
            report.append({
                "action": "remove_duplicates",
                "count": initial_len - len(df_clean),
                "reason": f"Removed {initial_len - len(df_clean)} identical rows to ensure data integrity."
            })

        # 4. Outlier handling
        for col, p in profile["columns"].items():
            if col in df_clean.columns and pd.api.types.is_numeric_dtype(df_clean[col]):
                if p.get("is_outlier_prone", False):
                    mean = df_clean[col].mean()
                    std = df_clean[col].std()
                    lower = mean - 3 * std
                    upper = mean + 3 * std
                    df_clean[col] = df_clean[col].clip(lower=lower, upper=upper)
                    report.append({
                        "action": "outlier_clipping",
                        "column": col,
                        "reason": f"High variability (skew={p['skewness']:.2f}); clipped to 3σ to normalize extreme impact."
                    })

        return df_clean, report

auto_clean_service = AutoCleanService()
