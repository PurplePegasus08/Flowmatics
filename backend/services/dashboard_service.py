import pandas as pd
from typing import List, Dict, Any
from logger import get_logger

logger = get_logger()

class DashboardService:
    """
    Service to analyze data and suggest dashboard visualizations.
    """

    def generate_dashboard(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Analyze dataframe and return a list of recommended charts.
        """
        charts = []
        
        # 1. Prepare Data Context
        # 1. Prepare Data Context
        import io
        buf = io.StringIO()
        df.info(buf=buf)
        info_str = buf.getvalue()
        
        sample = df.head(5).to_dict(orient='records')
        columns = df.columns.tolist()
        
        # 2. Try LLM Generation
        try:
            # Lazy import to avoid circular dependency
            from services.agent_service import agent_service
            
            if agent_service.llm:
                prompt = f"""
Given this dataset summary:
{info_str}

And these first 5 rows:
{sample}

Generate a JSON configuration for 4 to 6 meaningful dashboard charts that would give the best insights into this data.
The output must be a valid JSON array of objects.

Each object must follow this structure:
{{
    "id": "unique_string_id",
    "title": "Descriptive Title (e.g. 'Revenue by Region')",
    "type": "bar" | "line" | "scatter" | "pie",
    "xAxisKey": "column_name_for_x_axis",
    "yAxisKeys": ["column_name_for_y_axis", "optional_second_metric"],
    "aggregation": "sum" | "mean" | "count" | "none"
}}

CRITICAL DATA ANALYSIS RULES:
1. IGNORE ID COLUMNS: Never use columns like "PassengerId", "TicketId", "RowNo", or any column with "Id" that has high cardinality/uniqueness. They are useless for plotting.
2. IGNORE NAMES: Do not plot unique names (e.g. "Name") on axes unless aggregating count.
3. LOGICAL GROUPING: When using 'bar', group by categorical variables with few unique values (e.g. "Sex", "Embarked", "Class").
4. MEANINGFUL METRICS: Plot 'Fare', 'Age', 'Sales', 'Profit'.
5. SCATTER PLOTS: Only scatter two NUMERIC continuous variables (e.g. Age vs Fare). Do not scatter IDs.
6. Ensure 'xAxisKey' and 'yAxisKeys' exist in the columns: {columns}.
7. Respond ONLY with the valid JSON array, no markdown formatting.
"""
                from langchain_core.messages import HumanMessage
                import json
                import re

                logger.info("Invoking LLM for dashboard generation...")
                response = agent_service.llm.invoke([HumanMessage(content=prompt)]).content.strip()
                
                # Cleanup markdown if present
                content = response.replace('```json', '').replace('```', '').strip()
                # Try to parse
                try:
                    charts = json.loads(content)
                    logger.info(f"LLM generated {len(charts)} charts")
                    return charts
                except json.JSONDecodeError:
                    # Try to find array brackets if extra text exists
                    m = re.search(r'\[.*\]', content, re.S)
                    if m:
                        charts = json.loads(m.group(0))
                        return charts
                    logger.warning("Failed to parse LLM JSON for dashboard")

        except Exception as e:
            logger.error(f"LLM Dashboard Gen failed: {e}")
            # Fall through to heuristics
        
        # 3. Heuristic Fallback (Original Logic)
        logger.info("Falling back to heuristic dashboard generation")
        
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        # CRITICAL FIX: Filter out ID columns from heuristics
        numeric_cols = [c for c in numeric_cols if not c.lower().endswith('id') and c.lower() != 'id']
        
        categorical_cols = df.select_dtypes(include=['object', 'category', 'bool']).columns.tolist()
        date_cols = df.select_dtypes(include=['datetime']).columns.tolist()

        # Try to find date column if not explicit
        if not date_cols:
            for col in df.columns:
                if 'date' in col.lower() or 'time' in col.lower() or 'year' in col.lower():
                    try:
                        pd.to_datetime(df[col], errors='raise')
                        date_cols.append(col)
                    except:
                        pass
        
        # Rule A: Distribution
        if numeric_cols:
            primary_metric = numeric_cols[0]
            charts.append({
                "id": "chart_dist_1",
                "title": f"Distribution of {primary_metric}",
                "type": "bar",
                "xAxisKey": primary_metric,
                "yAxisKeys": [primary_metric],
                "aggregation": "count"
            })
            
            if len(numeric_cols) > 1:
                charts.append({
                    "id": "chart_scatter_1",
                    "title": f"{numeric_cols[0]} vs {numeric_cols[1]}",
                    "type": "scatter",
                    "xAxisKey": numeric_cols[0],
                    "yAxisKeys": [numeric_cols[1]]
                })

        # Rule B: Categorical
        best_cat = None
        for col in categorical_cols:
            if 2 <= df[col].nunique() <= 20:
                best_cat = col
                break
        
        if best_cat and numeric_cols:
             charts.append({
                "id": "chart_cat_1",
                "title": f"Sum of {numeric_cols[0]} by {best_cat}",
                "type": "bar",
                "xAxisKey": best_cat,
                "yAxisKeys": [numeric_cols[0]],
                "aggregation": "sum"
            })
        
        # Rule C: Time Series
        if date_cols and numeric_cols:
             charts.append({
                "id": "chart_time_1",
                "title": f"{numeric_cols[0]} over Time",
                "type": "line",
                "xAxisKey": date_cols[0],
                "yAxisKeys": [numeric_cols[0]],
                "aggregation": "mean"
            })
            
        return charts

dashboard_service = DashboardService()
