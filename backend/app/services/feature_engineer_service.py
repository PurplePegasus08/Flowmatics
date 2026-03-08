import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from app.core.logger import get_logger
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

logger = get_logger()

class FeatureEngineeringService:
    """
    Service for automated feature extraction, encoding, and scaling.
    Redesigned for Phase 2: Professional depth (PCA, skewness correction) and explainability.
    """

    def apply_smart_scaling(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Automatically scales numeric columns based on their distribution.
        """
        df_scaled = df.copy()
        numeric_cols = df_scaled.select_dtypes(include=[np.number]).columns
        report = []

        for col in numeric_cols:
            series = df_scaled[col].dropna()
            if series.empty: continue
            
            skew = series.skew()
            if abs(skew) < 0.5:
                # Normal-ish: Standardize
                mean, std = series.mean(), series.std()
                if std > 0:
                    df_scaled[col] = (df_scaled[col] - mean) / std
                    report.append({
                        "action": "standardize",
                        "column": col,
                        "reason": f"Symmetric distribution (skew={skew:.2f}). Standardized to mean=0, std=1."
                    })
            else:
                # Skewed: Min-Max scale
                min_val, max_val = series.min(), series.max()
                if max_val > min_val:
                    df_scaled[col] = (df_scaled[col] - min_val) / (max_val - min_val)
                    report.append({
                        "action": "minmax_scale",
                        "column": col,
                        "reason": f"Skewed distribution (skew={skew:.2f}). Scaled to [0, 1] range."
                    })
        
        return df_scaled, report

    def extract_datetime_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Automatically identifies date strings and extracts features.
        """
        df_ext = df.copy()
        report = []
        for col in df_ext.columns:
            if df_ext[col].dtype == 'object':
                try:
                    temp_dt = pd.to_datetime(df_ext[col], errors='coerce')
                    if temp_dt.notna().sum() > len(df_ext) * 0.8:
                        df_ext[f"{col}_year"] = temp_dt.dt.year
                        df_ext[f"{col}_month"] = temp_dt.dt.month
                        df_ext[f"{col}_dayofweek"] = temp_dt.dt.dayofweek
                        report.append({
                            "action": "extract_date",
                            "column": col,
                            "features": ["year", "month", "dayofweek"],
                            "reason": "Column identified as datetime strings."
                        })
                except:
                    pass
        return df_ext, report

    def auto_encode(self, df: pd.DataFrame, max_categories: int = 10) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Automatically encodes categorical variables.
        """
        df_enc = df.copy()
        cat_cols = df_enc.select_dtypes(include=['object', 'category']).columns
        report = []

        for col in cat_cols:
            unique_count = df_enc[col].nunique()
            if unique_count <= 2:
                df_enc[col] = df_enc[col].astype('category').cat.codes
                report.append({
                    "action": "binary_encode",
                    "column": col,
                    "reason": "Binary category; mapped to 0/1."
                })
            elif unique_count <= max_categories:
                df_enc = pd.get_dummies(df_enc, columns=[col], prefix=col)
                report.append({
                    "action": "onehot_encode",
                    "column": col,
                    "reason": f"Low cardinality ({unique_count} categories); expanded to binary columns."
                })
            else:
                df_enc[col] = df_enc[col].astype('category').cat.codes
                report.append({
                    "action": "label_encode",
                    "column": col,
                    "reason": f"High cardinality ({unique_count} categories); label-encoded to avoid feature explosion."
                })
        
        return df_enc, report

    def apply_pca(self, df: pd.DataFrame, variance_threshold: float = 0.95) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Applies PCA for dimensionality reduction if high collinearity is detected.
        """
        numeric_df = df.select_dtypes(include=[np.number]).dropna()
        if numeric_df.shape[1] < 5: # Only apply if enough features
            return df, []

        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_df)
        
        pca = PCA(n_components=variance_threshold)
        pca_data = pca.fit_transform(scaled_data)
        
        report = [{
            "action": "pca",
            "original_features": numeric_df.shape[1],
            "reduced_features": pca_data.shape[1],
            "explained_variance": float(np.sum(pca.explained_variance_ratio_)),
            "reason": f"Reduced {numeric_df.shape[1]} features to {pca_data.shape[1]} while retaining {variance_threshold*100}% variance."
        }]
        
        pca_cols = [f"pc_{i+1}" for i in range(pca_data.shape[1])]
        df_pca = pd.DataFrame(pca_data, columns=pca_cols, index=numeric_df.index)
        
        # Merge with non-numeric
        other_cols = df.select_dtypes(exclude=[np.number])
        return pd.concat([other_cols, df_pca], axis=1), report

    def prepare_for_ml(self, df: pd.DataFrame, use_pca: bool = False) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Full pipeline to make data 'model-ready' with combined report.
        """
        all_reports = []
        
        df_ml, r1 = self.extract_datetime_features(df)
        all_reports.extend(r1)
        
        df_ml, r2 = self.auto_encode(df_ml)
        all_reports.extend(r2)
        
        df_ml, r3 = self.apply_smart_scaling(df_ml)
        all_reports.extend(r3)

        if use_pca:
            df_ml, r4 = self.apply_pca(df_ml)
            all_reports.extend(r4)
        
        # Final cleanup: drop any remaining non-numeric
        df_ml = df_ml.select_dtypes(include=[np.number])
        
        return df_ml, all_reports

feature_engineer_service = FeatureEngineeringService()
