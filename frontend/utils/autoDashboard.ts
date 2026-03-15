/**
 * autoDashboard.ts
 *
 * Frontend utility to process backend chart configs into DashboardItems
 * with fully viewport-aware, non-overlapping layout positions.
 *
 * KEY DESIGN: We completely ignore the backend x/y positions (which are
 * calculated for a generic canvas) and recalculate based on the ACTUAL
 * window / canvas width at generation time.
 */

import { DashboardItem } from '../types';

// Chart-type-specific themes for visual variety
const CHART_THEMES_MAP: Record<string, string> = {
    metric: 'professional',
    area: 'saas',
    line: 'corporate',
    bar: 'default',
    pie: 'neon',
    doughnut: 'neon',
    scatter: 'pastel',
    treemap: 'default',
    radar: 'professional',
    funnel: 'saas',
};

// Layout constants
const MARGIN = 20;   // outer margin
const GAP = 16;   // gap between cards
const COLS = 2;    // chart columns
const CARD_H = 140;  // metric KPI card height
const CHART_H = 340;  // regular chart height
const GRID = 20;   // snap grid

const snap = (v: number) => Math.round(v / GRID) * GRID;

/**
 * Compute a fully correct, non-overlapping floating layout.
 * Call this AFTER calling setDashboardItems so the DOM width is available.
 *
 * @param rawCharts   — raw chart configs from the backend
 * @param canvasWidth — actual pixel width of the dashboard canvas element
 */
export function processAutoDashboardItems(
    rawCharts: any[],
    canvasWidth: number = window.innerWidth - 240  // fallback: window minus sidebar
): DashboardItem[] {
    if (rawCharts.length === 0) return [];

    const metrics = rawCharts.filter(c => c.type === 'metric');
    const charts = rawCharts.filter(c => c.type !== 'metric');

    // How wide each metric card is (fill the row evenly)
    const metricSlotW = metrics.length > 0
        ? snap(Math.floor((canvasWidth - MARGIN * 2 - GAP * (metrics.length - 1)) / metrics.length))
        : 0;

    // How wide each regular chart is (fill 2 columns)
    const totalPad = MARGIN * 2 + GAP * (COLS - 1);
    const chartSlotW = snap(Math.floor((canvasWidth - totalPad) / COLS));

    const items: DashboardItem[] = [];
    let zIdx = 10;

    // ── Metric cards: row at y=MARGIN ────────────────────────────────────────
    metrics.forEach((chart, i) => {
        items.push(buildItem(chart, {
            x: snap(MARGIN + i * (metricSlotW + GAP)),
            y: snap(MARGIN),
            width: metricSlotW,
            height: snap(CARD_H),
            zIndex: zIdx++,
        }));
    });

    const chartsStartY = metrics.length > 0
        ? snap(MARGIN + CARD_H + GAP)
        : snap(MARGIN);

    // ── Charts: 2-column tiled grid ──────────────────────────────────────────
    charts.forEach((chart, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        items.push(buildItem(chart, {
            x: snap(MARGIN + col * (chartSlotW + GAP)),
            y: chartsStartY + snap(row * (CHART_H + GAP)),
            width: chartSlotW,
            height: snap(CHART_H),
            zIndex: zIdx++,
        }));
    });

    return items;
}

function buildItem(chart: any, layout: { x: number; y: number; width: number; height: number; zIndex: number }): DashboardItem {
    return {
        id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: chart.title || 'Chart',
        type: chart.type || 'bar',
        xAxisKey: chart.xAxisKey || '',
        yAxisKeys: chart.yAxisKeys || [],
        aggregation: chart.aggregation || 'sum',
        theme: (CHART_THEMES_MAP[chart.type] || 'default') as any,
        showGrid: true,
        showXAxis: true,
        showYAxis: true,
        ...layout,
    };
}
