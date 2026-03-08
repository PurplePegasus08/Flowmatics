import pandas as pd
import numpy as np
from typing import List, Dict, Any
from app.core.logger import get_logger

logger = get_logger()

class InsightEngine:
    """
    Service for proactive insight discovery: Correlations, Anomalies, and Patterns.
    """

    def detect_correlations(self, df: pd.DataFrame, threshold: float = 0.6) -> List[Dict[str, Any]]:
        """
        Identify significant correlations between numeric columns.
        """
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.shape[1] < 2:
            return []

        corr_matrix = numeric_df.corr()
        insights = []

        cols = corr_matrix.columns
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                val = corr_matrix.iloc[i, j]
                if abs(val) >= threshold:
                    insights.append({
                        "type": "correlation",
                        "columns": [cols[i], cols[j]],
                        "value": float(val),
                        "strength": "strong" if abs(val) > 0.8 else "moderate",
                        "description": f"{cols[i]} and {cols[j]} show a { 'positive' if val > 0 else 'negative' } { 'strong' if abs(val) > 0.8 else 'moderate' } correlation ({val:.2f})."
                    })
        
        return insights

    def detect_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Detect anomalies in numeric columns using Z-score heuristic.
        (Future: Use IsolationForest for multivariate anomalies)
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        insights = []

        for col in numeric_cols:
            series = df[col].dropna()
            if series.empty: continue
            
            mean = series.mean()
            std = series.std()
            if std == 0: continue

            z_scores = (series - mean) / std
            anomalies = series[abs(z_scores) > 3]
            
            if len(anomalies) > 0:
                insights.append({
                    "type": "anomaly",
                    "column": col,
                    "count": int(len(anomalies)),
                    "pct": float(len(anomalies) / len(df)) * 100,
                    "description": f"Found {len(anomalies)} potential anomalies in {col} (values > 3σ from mean)."
                })

        return insights

    def detect_trends(self, df: pd.DataFrame, time_column: str, value_column: str, window: int = 3) -> List[Dict[str, Any]]:
        """
        Detect trends in time-series data using rolling mean.
        Requires a time-based column and a numeric value column.
        """
        insights = []
        if time_column not in df.columns or value_column not in df.columns:
            return insights

        if not pd.api.types.is_numeric_dtype(df[value_column]):
            return insights

        try:
            df_sorted = df.sort_values(by=time_column).copy()
            df_sorted['rolling_mean'] = df_sorted[value_column].rolling(window=window).mean()
            
            if len(df_sorted) > window:
                first_rolling_mean = df_sorted['rolling_mean'].iloc[window-1]
                last_rolling_mean = df_sorted['rolling_mean'].iloc[-1]

                if last_rolling_mean > first_rolling_mean * 1.1:
                    insights.append({
                        "type": "trend",
                        "trend_type": "upward",
                        "time_column": time_column,
                        "value_column": value_column,
                        "description": f"Detected an upward trend in '{value_column}' over time based on rolling mean."
                    })
                elif last_rolling_mean < first_rolling_mean * 0.9:
                    insights.append({
                        "type": "trend",
                        "trend_type": "downward",
                        "time_column": time_column,
                        "value_column": value_column,
                        "description": f"Detected a downward trend in '{value_column}' over time based on rolling mean."
                    })
        except Exception as e:
            logger.error(f"Error during trend detection for {value_column}: {e}")

        return insights

    def get_quick_insights(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Run all discovery methods and return a combined list of insights.
        """
        all_insights = []
        try:
            all_insights.extend(self.detect_correlations(df))
            all_insights.extend(self.detect_anomalies(df))
            
            # Auto-trend detection
            date_cols = df.select_dtypes(include=['datetime']).columns.tolist()
            num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            
            if date_cols and num_cols:
                for d_col in date_cols[:2]:
                    for n_col in num_cols[:5]:
                        all_insights.extend(self.detect_trends(df, d_col, n_col))
                        
        except Exception as e:
            logger.error(f"InsightEngine error: {e}")
            
        return all_insights

insight_engine = InsightEngine()
