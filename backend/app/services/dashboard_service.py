"""
Smart Dashboard Service — Intelligent, professional dashboard generation.
Analyzes any dataset and produces relevant, visually meaningful chart configs.
"""

import pandas as pd
import numpy as np
import re
from typing import List, Dict, Any, Optional
from app.core.logger import get_logger

logger = get_logger()

# ---------------------------------------------------------------------------
# Layout constants  (floating dashboard canvas uses pixel positions)
# ---------------------------------------------------------------------------
CARD_W, CARD_H = 220, 140       # Metric KPI card dimensions
CHART_W, CHART_H = 480, 360     # Standard chart dimensions
MARGIN = 20                     # Gap between charts
CANVAS_COLS = 2                 # Charts per row in auto-layout


# ---------------------------------------------------------------------------
# Column Profiling Helpers
# ---------------------------------------------------------------------------

def _is_id_like(col: str, series: pd.Series) -> bool:
    """Return True if the column looks like an identifier (useless for plotting)."""
    col_lower = col.lower()
    # Name patterns
    if re.search(r'(^id$|_id$|^idx$|_idx$|^index$|rownum|row_num|uuid|guid)', col_lower):
        return True
    # High-cardinality integers that aren't very meaningful
    if series.dtype in [np.int64, np.int32, np.int16] and series.nunique() / max(len(series), 1) > 0.95:
        return True
    # High-cardinality string (e.g. names, addresses)
    if series.dtype == object and series.nunique() / max(len(series), 1) > 0.7:
        return True
    return False


def _is_date_like(col: str, series: pd.Series) -> bool:
    """Return True if the column looks like a date/time field."""
    col_lower = col.lower()
    if any(kw in col_lower for kw in ['date', 'time', 'year', 'month', 'week', 'day', 'dt', 'at', 'created', 'updated', 'timestamp']):
        if series.dtype in ['datetime64[ns]', 'datetime64']:
            return True
        if series.dtype == object:
            sample = series.dropna().head(50)
            try:
                pd.to_datetime(sample, errors='raise')
                return True
            except Exception:
                pass
    if series.dtype in ['datetime64[ns]', 'datetime64']:
        return True
    return False


def _is_boolean_like(col: str, series: pd.Series) -> bool:
    """Return True if column has 2 values (binary/boolean)."""
    if series.dtype == bool:
        return True
    unique_vals = set(str(v).lower() for v in series.dropna().unique())
    if unique_vals.issubset({'0', '1', 'true', 'false', 'yes', 'no', 'y', 'n', 't', 'f'}):
        return True
    return False


def profile_dataframe(df: pd.DataFrame) -> Dict[str, Dict]:
    """
    Profile every column and return a dict of:
    { col_name: { type, n_unique, is_id, is_date, cardinality, sample_mean } }
    """
    profiles = {}
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            continue

        is_id = _is_id_like(col, series)
        is_date = _is_date_like(col, series)
        is_bool = _is_boolean_like(col, series)

        if is_date:
            col_type = 'datetime'
        elif is_id:
            col_type = 'id'
        elif is_bool:
            col_type = 'boolean'
        elif pd.api.types.is_numeric_dtype(series):
            col_type = 'numeric'
        else:
            col_type = 'categorical'

        n_unique = series.nunique()
        sample_mean = float(series.mean()) if col_type == 'numeric' else None

        profiles[col] = {
            'type': col_type,
            'n_unique': n_unique,
            'is_id': is_id,
            'is_date': is_date,
            'is_bool': is_bool,
            'cardinality': n_unique / max(len(series), 1),
            'sample_mean': sample_mean,
        }

    return profiles


# ---------------------------------------------------------------------------
# Title Formatting
# ---------------------------------------------------------------------------

def _prettify(col: str) -> str:
    """Convert column name to a readable label."""
    s = re.sub(r'[_\-]', ' ', col)
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)  # camelCase
    return s.title()


def _make_title(agg: str, metric: str, dimension: Optional[str] = None) -> str:
    agg_word = {'sum': 'Total', 'avg': 'Average', 'count': 'Count of', 'max': 'Max', 'min': 'Min'}.get(agg, agg.title())
    if dimension:
        return f"{agg_word} {_prettify(metric)} by {_prettify(dimension)}"
    return f"{agg_word} {_prettify(metric)}"


# ---------------------------------------------------------------------------
# Chart Factory
# ---------------------------------------------------------------------------

def _make_chart(chart_id: str, title: str, chart_type: str,
                x_key: str, y_keys: List[str], agg: str = 'sum',
                theme: str = 'default') -> Dict:
  return {
      "id": chart_id,
      "title": title,
      "type": chart_type,
      "xAxisKey": x_key,
      "yAxisKeys": y_keys,
      "aggregation": agg,
      "theme": theme,
      "showGrid": True,
      "showXAxis": True,
      "showYAxis": True,
  }


# ---------------------------------------------------------------------------
# Smart Rule Engine
# ---------------------------------------------------------------------------

class DashboardService:
    """
    Intelligent dashboard generator that analyses any dataset and
    produces professional, business-ready chart configurations.
    """

    def generate_dashboard(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Main entry point — profile data then apply rules."""
        charts: List[Dict] = []
        chart_counter = [0]

        def next_id(prefix: str) -> str:
            chart_counter[0] += 1
            return f"{prefix}_{chart_counter[0]}"

        logger.info(f"Smart dashboard gen: {len(df)} rows, {len(df.columns)} cols")

        profiles = profile_dataframe(df)

        # Separate column groups
        numeric_cols  = [c for c, p in profiles.items() if p['type'] == 'numeric']
        cat_cols      = [c for c, p in profiles.items() if p['type'] == 'categorical']
        date_cols     = [c for c, p in profiles.items() if p['type'] == 'datetime']
        bool_cols     = [c for c, p in profiles.items() if p['type'] == 'boolean']

        # Sort categorical by cardinality (prefer low-cardinality for grouping)
        cat_cols_grouped = sorted(
            [c for c in cat_cols if 2 <= profiles[c]['n_unique'] <= 25],
            key=lambda c: profiles[c]['n_unique']
        )
        # High-cardinality categoricals (for treemaps)
        cat_cols_high = [c for c in cat_cols if 5 <= profiles[c]['n_unique'] <= 50]

        # Select top 3 numeric by variance as "key metrics"
        key_metrics = sorted(
            numeric_cols,
            key=lambda c: df[c].std() if not df[c].isnull().all() else 0,
            reverse=True
        )[:5]

        # ── RULE 1: KPI Metric Cards ─────────────────────────────────────────
        # Show top numeric summaries
        metric_order = ['revenue', 'sales', 'profit', 'amount', 'value', 'price', 'total', 'count']
        prioritised = sorted(
            numeric_cols,
            key=lambda c: next((i for i, kw in enumerate(metric_order) if kw in c.lower()), 99)
        )

        for col in prioritised[:4]:
            agg = 'sum' if any(kw in col.lower() for kw in ['revenue','sales','profit','amount','total','cost']) else 'avg'
            charts.append(_make_chart(
                next_id('metric'),
                f"Total {_prettify(col)}" if agg == 'sum' else f"Avg {_prettify(col)}",
                'metric',
                col,
                [col],
                agg=agg,
            ))
            if len([c for c in charts if c['type'] == 'metric']) >= 3:
                break

        # ── RULE 2: Time Series ───────────────────────────────────────────────
        if date_cols:
            date_col = date_cols[0]
            ts_metrics = key_metrics[:2]
            if ts_metrics:
                charts.append(_make_chart(
                    next_id('ts_area'),
                    f"{_prettify(ts_metrics[0])} Over Time",
                    'area',
                    date_col,
                    ts_metrics[:1],
                    agg='sum',
                    theme='saas',
                ))
            if len(ts_metrics) > 1:
                charts.append(_make_chart(
                    next_id('ts_line'),
                    f"{_prettify(ts_metrics[1])} Trend",
                    'line',
                    date_col,
                    ts_metrics[1:2],
                    agg='avg',
                    theme='corporate',
                ))

        # ── RULE 3: Categorical Bar Charts ────────────────────────────────────
        bars_added = 0
        for cat_col in cat_cols_grouped[:3]:
            if not key_metrics:
                break
            metric = key_metrics[bars_added % len(key_metrics)]
            agg = 'sum' if any(kw in metric.lower() for kw in ['revenue','sales','profit','amount','total','cost']) else 'avg'
            charts.append(_make_chart(
                next_id('bar_cat'),
                _make_title(agg, metric, cat_col),
                'bar',
                cat_col,
                [metric],
                agg=agg,
            ))
            bars_added += 1
            if bars_added >= 2:
                break

        # ── RULE 4: Pie/Doughnut — Composition ───────────────────────────────
        pie_candidates = [c for c in cat_cols_grouped if profiles[c]['n_unique'] <= 8]
        if pie_candidates and key_metrics:
            pie_col = pie_candidates[0]
            metric = key_metrics[0]
            agg = 'sum' if any(kw in metric.lower() for kw in ['revenue','sales','profit','amount','total','cost']) else 'count'
            charts.append(_make_chart(
                next_id('pie'),
                f"{_prettify(metric)} Breakdown by {_prettify(pie_col)}",
                'pie',
                pie_col,
                [metric] if agg != 'count' else [],
                agg=agg,
                theme='neon',
            ))

        # ── RULE 5: Scatter — Numeric Correlation ─────────────────────────────
        if len(key_metrics) >= 2:
            m1, m2 = key_metrics[0], key_metrics[1]
            if m1 != m2:
                charts.append(_make_chart(
                    next_id('scatter'),
                    f"{_prettify(m1)} vs {_prettify(m2)} Correlation",
                    'scatter',
                    m1,
                    [m2],
                ))

        # ── RULE 6: Treemap — Part-to-whole ──────────────────────────────────
        if cat_cols_high and key_metrics:
            tm_col = cat_cols_high[0]
            tm_metric = key_metrics[0]
            charts.append(_make_chart(
                next_id('treemap'),
                f"{_prettify(tm_metric)} Distribution by {_prettify(tm_col)}",
                'treemap',
                tm_col,
                [tm_metric],
                agg='sum',
            ))

        # ── RULE 7: Boolean Bar ────────────────────────────────────────────────
        if bool_cols and key_metrics:
            bc = bool_cols[0]
            charts.append(_make_chart(
                next_id('bool_bar'),
                f"{_prettify(key_metrics[0])} by {_prettify(bc)}",
                'bar',
                bc,
                [key_metrics[0]],
                agg='sum',
            ))

        # Cap at 8 charts for clean layout
        charts = charts[:8]

        logger.info(f"Generated {len(charts)} charts")
        return charts


dashboard_service = DashboardService()
