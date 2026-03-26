"""
LLM Dashboard Service — Generates a complete, self-contained Plotly.js HTML dashboard
using the LLM. The LLM receives a structured data profile and returns a full HTML page
with interactive Plotly charts, KPI cards, and a professional dark theme.
"""

import json
import re
import pandas as pd
import numpy as np
from typing import Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger()


# ---------------------------------------------------------------------------
# Data Profiler
# ---------------------------------------------------------------------------

def _safe_val(v):
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if pd.isna(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 4)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def _build_data_profile(df: pd.DataFrame) -> dict:
    """
    Build a concise but rich profile of the DataFrame to feed to the LLM.
    Includes column types, stats, and a small sample of data.
    """
    profile = {
        "rows": len(df),
        "columns": list(df.columns),
        "column_types": {},
        "column_stats": {},
        "sample_data": [],
    }

    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            profile["column_types"][col] = "empty"
            continue

        if pd.api.types.is_datetime64_any_dtype(series):
            col_type = "datetime"
        elif pd.api.types.is_numeric_dtype(series):
            col_type = "numeric"
        elif series.nunique() <= 30:
            col_type = "categorical"
        else:
            col_type = "text"

        profile["column_types"][col] = col_type

        if col_type == "numeric":
            profile["column_stats"][col] = {
                "min": _safe_val(series.min()),
                "max": _safe_val(series.max()),
                "mean": _safe_val(series.mean()),
                "std": _safe_val(series.std()),
                "sum": _safe_val(series.sum()),
                "unique": int(series.nunique()),
            }
        elif col_type in ("categorical", "datetime"):
            vc = series.value_counts()
            profile["column_stats"][col] = {
                "unique": int(series.nunique()),
                "top_values": {str(k): int(v) for k, v in vc.head(10).items()},
            }

    # Include a 5-row sample as context
    try:
        sample_df = df.head(5).replace({np.nan: None, np.inf: None, -np.inf: None})
        profile["sample_data"] = sample_df.astype(object).where(
            sample_df.notna(), None
        ).to_dict(orient="records")
    except Exception:
        profile["sample_data"] = []

    return profile


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a world-class data visualization expert and senior frontend developer.
Your task is to generate a COMPLETE, self-contained HTML file that produces a stunning, interactive dashboard using Plotly.js loaded from CDN.

STRICT RULES:
1. Return ONLY the raw HTML — no markdown, no code fences, no explanation text before or after.
2. The HTML must be 100% self-contained. All JS/CSS inline or via CDN. No external file dependencies.
3. Use Plotly.js from: https://cdn.plot.ly/plotly-2.32.0.min.js
4. DO NOT use Python. Use only vanilla JavaScript inside <script> tags.
5. Embed the data DIRECTLY as JavaScript arrays/objects — do NOT fetch from any URL.
6. Make the dashboard visually stunning with a dark professional theme (#0f172a background).
7. Include multiple chart types where they make sense: bar, line, pie/donut, scatter, area.
8. Include 2–4 KPI metric cards at the top row showing key aggregated numbers.
9. Every chart MUST have interactive tooltips, hover effects, and zoom/pan enabled.
10. Use a responsive CSS grid layout so the dashboard fills the full viewport.
11. Charts must have proper titles, axis labels, and legends.
12. Use a visually appealing color palette like: #6366f1, #8b5cf6, #06b6d4, #10b981, #f59e0b, #ef4444.
13. DO NOT ask for clarification. Generate the best possible dashboard from the data profile provided.
14. The output must be a single HTML file that works when opened directly in a browser.
"""


def _build_prompt(profile: dict) -> str:
    profile_json = json.dumps(profile, indent=2, default=str)
    return f"""{_SYSTEM_PROMPT}

DATA PROFILE:
{profile_json}

INSTRUCTIONS:
- Analyze the profile above carefully.
- Choose the most insightful 4–8 visualizations based on the column types and statistics.
- For NUMERIC columns: use bar charts, line charts, scatter plots, histograms.
- For CATEGORICAL columns: use bar charts, pie/donut charts.
- For DATETIME + NUMERIC combos: use line/area time-series charts.
- The KPI cards should show aggregated totals/averages of the most important numeric columns.
- The embedded data should use the statistics and top_values from the profile to reconstruct representative chart data.
- If the dataset has many rows, use the aggregated statistics — do NOT try to embed all rows.
- Add a clean header with a title, subtitle (dataset stats), and today's date.
- Use Plotly's built-in dark template: layout.template = 'plotly_dark' for all charts.
- Add subtle CSS transitions and hover effects on KPI cards.

Generate the complete HTML file now:"""


# ---------------------------------------------------------------------------
# HTML Fallback
# ---------------------------------------------------------------------------

_FALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flowmatics — Plotly AI Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f172a; color: #f1f5f9; font-family: 'Segoe UI', system-ui, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 16px; }
  .icon { font-size: 48px; }
  h2 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
  p  { font-size: 13px; color: #64748b; }
</style>
</head>
<body>
  <div class="icon">⚠️</div>
  <h2>Dashboard generation failed</h2>
  <p>The LLM did not return valid HTML. Please try regenerating.</p>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class LLMDashboardService:
    """Uses the configured LLM to generate a complete Plotly.js HTML dashboard."""

    def _get_llm(self):
        """Lazily initialise the LLM (same pattern as AgentService)."""
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=settings.llm_model,
                temperature=0.4,
                google_api_key=settings.api_key,
                timeout=120,   # longer timeout — Plotly HTML can be verbose
            )
        except Exception as e:
            logger.error(f"LLM init failed: {e}")
            return None

    def generate(self, df: pd.DataFrame) -> str:
        """
        Profile `df`, ask the LLM to generate a Plotly HTML dashboard, and return
        the HTML string. Falls back to a safe error page on failure.
        """
        try:
            logger.info(f"LLM Plotly dashboard: {len(df)} rows × {len(df.columns)} cols")
            profile = _build_data_profile(df)
            prompt = _build_prompt(profile)

            llm = self._get_llm()
            if llm is None:
                logger.error("LLM unavailable for Plotly dashboard generation")
                return _FALLBACK_HTML

            from langchain_core.messages import HumanMessage
            response = llm.invoke([HumanMessage(content=prompt)])
            raw = response.content.strip()

            # Strip markdown code fences if the LLM wrapped the HTML
            raw = re.sub(r'^```html?\s*', '', raw, flags=re.IGNORECASE)
            raw = re.sub(r'\s*```$', '', raw, flags=re.IGNORECASE)
            raw = raw.strip()

            # Minimal sanity check — must look like HTML
            if not raw.lower().startswith('<!doctype') and '<html' not in raw.lower():
                # Try to find HTML block inside the response
                match = re.search(r'(<!DOCTYPE html.*?</html>)', raw, re.IGNORECASE | re.DOTALL)
                if match:
                    raw = match.group(1).strip()
                else:
                    logger.warning("LLM response did not contain valid HTML")
                    return _FALLBACK_HTML

            logger.info("Plotly dashboard HTML generated successfully")
            return raw

        except Exception as e:
            logger.error(f"Plotly dashboard generation error: {e}", exc_info=True)
            return _FALLBACK_HTML


llm_dashboard_service = LLMDashboardService()
