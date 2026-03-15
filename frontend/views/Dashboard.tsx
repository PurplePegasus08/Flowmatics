import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardItem, DataRow, AggregationType, SortOrder, LegendPosition } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Label, Legend, ScatterChart, Scatter, ZAxis, Tooltip, LabelList, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap, ComposedChart, Funnel, FunnelChart, Rectangle } from 'recharts';
import { Trash2, Download, Lock, Unlock, Grid3X3, RotateCcw, Settings2, X, Type, Gauge, Hash, SlidersHorizontal, GripVertical, LayoutTemplate, Activity, Maximize2, Minimize2, LayoutGrid, Sparkles, Image as ImageIcon, FileCode, Share2, Palette } from 'lucide-react';
import { CHART_THEMES } from './Visualization';
import { processChartData } from '../utils/chartUtils';
import { InsightCard } from '../components/InsightCard';
import { MetricCard } from '../components/MetricCard';

interface DashboardProps {
  data: DataRow[];
  headers: string[];
  isDarkMode: boolean;
  items: DashboardItem[];
  onUpdateItem: (id: string, updates: Partial<DashboardItem>) => void;
  onRemoveItem: (id: string) => void;

  onNavigateToData: () => void;
  onAutoGenerate: () => void;
  onUndo: () => void;
  sessionId: string;
  onAskAboutChart: (title: string) => void;
}

interface AlignmentGuide {
  type: 'h' | 'v';
  pos: number;
}

const GRID_SIZE = 20;

const CustomTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-4 rounded-2xl shadow-2xl border-none backdrop-blur-xl animate-slide-up ${isDarkMode ? 'bg-surface-900/90 text-white' : 'bg-white/90 text-surface-900'}`}>
        <p className="text-[10px] font-black upperca   tracking-widest mb-2 opacity-50">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-[11px] font-bold">{entry.name}:</span>
              <span className="text-[11px] font-mono">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const DashboardChart = React.memo(({ item, data, isDarkMode }: { item: DashboardItem, data: DataRow[], isDarkMode: boolean }) => {
  const colors = CHART_THEMES[item.theme || 'default'];
  const chartData = useMemo(() => processChartData(data, item), [data, item]);

  const hasYAxis = item.yAxisKeys && item.yAxisKeys.length > 0;
  const dataKey = hasYAxis ? item.yAxisKeys[0] : "value";

  const xAxisLabel = item.xAxisTitle || item.xAxisKey;
  const yAxisLabel = item.yAxisTitle || (hasYAxis ? (item.yAxisKeys.length === 1 ? `${item.yAxisKeys[0]}` : 'Metric') : 'Frequency');

  const axisStroke = isDarkMode ? "#334155" : "#E2E8F0";
  const axisStyle = { fontSize: 10, fill: axisStroke, fontWeight: 500 };
  const labelStyle = { fill: isDarkMode ? '#475569' : '#94a3b8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em' };
  const gridStroke = isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const margin = { top: 15, right: 15, left: 0, bottom: 40 };

  const showX = item.showXAxis ?? true;
  const showY = item.showYAxis ?? true;
  const showG = item.showGrid ?? true;
  const showL = item.showLegend ?? false;
  const lineType = item.smoothCurve ?? true ? 'monotone' : 'linear';

  const dataLabelProps = item.showLabels ? {
    fill: item.labelColor || (isDarkMode ? '#ffffff' : '#334155'),
    fontSize: item.labelFontSize || 10,
    fontWeight: 600,
    position: 'top' as any,
    offset: 10
  } : null;

  const chartAxes = (
    <>
      {showG && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />}
      <XAxis hide={!showX} dataKey={item.type === 'scatter' || item.type === 'bubble' ? "x" : "name"} tick={axisStyle} interval="preserveStartEnd" tickLine={false} axisLine={false} height={30}>
        <Label value={xAxisLabel} position="insideBottom" offset={-10} style={labelStyle} />
      </XAxis>
      <YAxis hide={!showY} dataKey={item.type === 'scatter' || item.type === 'bubble' ? "y" : undefined} tick={axisStyle} tickLine={false} axisLine={false} width={45}>
        <Label value={yAxisLabel} angle={-90} position="insideLeft" style={{ ...labelStyle, textAnchor: 'middle' }} />
      </YAxis>
      <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
      {showL && <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: axisStroke }} />}
    </>
  );

  if (item.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={margin}>
          <defs>
            <linearGradient id={`barGradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={1} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          {chartAxes}
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId={item.stacked ? "stack" : undefined} fill={`url(#barGradient-${item.id})`} radius={[6, 6, 0, 0]}>
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Bar>
          )) : (
            <Bar dataKey="value" fill={`url(#barGradient-${item.id})`} radius={[6, 6, 0, 0]}>
              {item.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    )
  }
  if (item.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={margin}>
          {chartAxes}
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Line key={key} type={lineType} dataKey={key} stroke={colors[i % colors.length]} dot={item.showLabels} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Line>
          )) : (
            <Line type={lineType} dataKey="value" stroke={colors[0]} dot={item.showLabels} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
            </Line>
          )}
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (item.type === 'pie' || item.type === 'doughnut') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={margin}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius={item.type === 'doughnut' ? '60%' : '0%'}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey="name"
            stroke={isDarkMode ? "#1e293b" : "#ffffff"}
            strokeWidth={2}
            label={item.showLabels ? {
              fill: item.labelColor || (isDarkMode ? '#ffffff' : '#334155'),
              fontSize: item.labelFontSize || 10
            } : false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          {showL && <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: axisStroke }} />}
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (item.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={margin}>
          <defs>
            <linearGradient id={`areaGradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={0.4} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {chartAxes}
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Area key={key} type={lineType} stackId={item.stacked ? "stack" : undefined} dataKey={key} stroke={colors[i % colors.length]} fill={`url(#areaGradient-${item.id})`} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Area>
          )) : (
            <Area type={lineType} dataKey="value" stroke={colors[0]} fill={`url(#areaGradient-${item.id})`} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
            </Area>
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'heatmap_matrix') {
    const dataKeys = Object.keys(chartData[0] || {}).filter(k => k !== 'name');
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
          <XAxis type="category" dataKey="name" tick={axisStyle} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          {dataKeys.map((key, idx) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors[idx % colors.length]} radius={0}>
              <LabelList dataKey={key} position="center" fill="#fff" fontSize={10} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'step_line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={margin}>
          {chartAxes}
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          {item.yAxisKeys.map((key, i) => (
            <Line key={key} type="stepAfter" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 4, fill: colors[i % colors.length] }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'radar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke={gridStroke} />
          <PolarAngleAxis dataKey="name" tick={axisStyle} />
          <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={axisStyle} />
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Radar key={key} name={key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.4} />
          )) : (
            <Radar name="Value" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.4} />
          )}
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
          {showL && <Legend />}
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'treemap') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={chartData}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill={colors[0]}
        >
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
        </Treemap>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'scatter' || item.type === 'bubble') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={margin}>
          {chartAxes}
          <Scatter data={chartData} fill={colors[0]}>
            {chartData.map((_: any, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} fillOpacity={0.75} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'funnel') {
    const funnelData = chartData.map((d: any, i: number) => ({ ...d, fill: colors[i % colors.length] }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Funnel dataKey="value" data={funnelData} isAnimationActive>
            {funnelData.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Funnel>
          <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
        </FunnelChart>
      </ResponsiveContainer>
    );
  }
  // Fallback — generic bar chart so nothing goes blank
  if (chartData.length > 0) {
    const fallbackKey = Object.keys(chartData[0]).find(k => k !== 'name') || 'value';
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={margin}>
          {chartAxes}
          <Bar dataKey={fallbackKey} fill={colors[0]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-[10px] font-bold uppercase tracking-widest">No data available</p>
    </div>
  );
});

export const Dashboard: React.FC<DashboardProps> = ({ data, headers, isDarkMode, items, onUpdateItem, onRemoveItem, onNavigateToData, onAutoGenerate, onUndo, sessionId, onAskAboutChart }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialDim, setInitialDim] = useState({ w: 0, h: 0 });
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const handleExportImage = async () => {
    const dashboard = document.getElementById('dashboard-grid');
    if (!dashboard) return;
    setIsExporting(true);
    try {
      // @ts-ignore
      const canvas = await window.html2canvas(dashboard, {
        backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `Flowmatics_Dashboard_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHTML = () => {
    if (items.length === 0) return;

    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const bg = isDarkMode ? '#0f172a' : '#f8fafc';
    const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
    const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';
    const subtleText = isDarkMode ? '#64748b' : '#94a3b8';
    const borderColor = isDarkMode ? '#334155' : '#e2e8f0';

    const chartRows = items.map(item => {
      const chartData = processChartData(data, item);
      const isMetric = item.type === 'metric';

      if (isMetric) {
        const value = chartData[0]?.value ?? 0;
        return `
<div class="metric-card">
  <div class="metric-label">${item.title}</div>
  <div class="metric-value">${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}</div>
</div>`;
      }

      const tableRows = chartData.slice(0, 10).map((row: any) => {
        const cells = Object.entries(row)
          .filter(([k]) => !k.startsWith('_'))
          .map(([k, v]) => `<td class="td">${typeof v === 'number' ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const headers = Object.keys(chartData[0] || {})
        .filter(k => !k.startsWith('_'))
        .map(k => `<th class="th">${k}</th>`).join('');

      return `
<div class="chart-block">
  <div class="chart-title">${item.title}</div>
  <div class="chart-type-pill">${item.type.toUpperCase()}</div>
  <table class="data-table">
    <thead><tr>${headers}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  ${chartData.length > 10 ? `<p class="more-note">Showing top 10 of ${chartData.length} records</p>` : ''}
</div>`;
    }).join('');

    const metricCards = items.filter(i => i.type === 'metric');
    const otherCharts = items.filter(i => i.type !== 'metric');

    const metricSection = metricCards.length > 0 ? `
<div class="metrics-row">
  ${metricCards.map(item => {
      const chartData = processChartData(data, item);
      const value = chartData[0]?.value ?? 0;
      return `<div class="metric-card"><div class="metric-label">${item.title}</div><div class="metric-value">${typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}</div></div>`;
    }).join('')}
</div>` : '';

    const chartSection = otherCharts.map(item => {
      const chartData = processChartData(data, item);
      const tableRows = chartData.slice(0, 15).map((row: any) => {
        const cells = Object.entries(row)
          .filter(([k]) => !k.startsWith('_'))
          .map(([k, v]) => `<td class="td">${typeof v === 'number' ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      const headers = Object.keys(chartData[0] || {}).filter(k => !k.startsWith('_')).map(k => `<th class="th">${k}</th>`).join('');
      return `
<div class="chart-block">
  <div class="chart-header"><span class="chart-title">${item.title}</span><span class="chart-badge">${item.type}</span></div>
  <table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody></table>
  ${chartData.length > 15 ? `<div class="more-note">+ ${chartData.length - 15} more rows</div>` : ''}
</div>`;
    }).join('');

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Flowmatics Report — ${now}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${bg}; color: ${textColor}; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 48px; }
  .page-header { border-bottom: 2px solid ${borderColor}; padding-bottom: 24px; margin-bottom: 40px; }
  .page-title { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; }
  .page-subtitle { font-size: 12px; color: ${subtleText}; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
  .metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 40px; }
  .metric-card { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 16px; padding: 24px; }
  .metric-label { font-size: 11px; font-weight: 700; color: ${subtleText}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
  .metric-value { font-size: 32px; font-weight: 900; color: ${textColor}; }
  .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 24px; }
  .chart-block { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 16px; padding: 28px; break-inside: avoid; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .chart-title { font-size: 14px; font-weight: 800; color: ${textColor}; }
  .chart-badge { font-size: 9px; font-weight: 900; color: ${subtleText}; text-transform: uppercase; letter-spacing: 0.15em; background: ${bg}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 3px 8px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .th { padding: 9px 12px; text-align: left; font-size: 10px; font-weight: 700; color: ${subtleText}; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid ${borderColor}; }
  .td { padding: 9px 12px; border-bottom: 1px solid ${borderColor}; color: ${textColor}; }
  tbody tr:last-child .td { border-bottom: none; }
  tbody tr:hover td { background: ${isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}; }
  .more-note { font-size: 10px; color: ${subtleText}; margin-top: 12px; font-weight: 600; }
  .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid ${borderColor}; font-size: 11px; color: ${subtleText}; font-weight: 600; }
  @media print { body { padding: 20px; } .charts-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="page-header">
    <div class="page-title">Analytics Report</div>
    <div class="page-subtitle">Generated by Flowmatics · ${now} · ${items.length} insights</div>
  </div>
  ${metricSection}
  <div class="charts-grid">${chartSection}</div>
  <div class="footer">Flowmatics Intelligence Report — All data is derived from your uploaded dataset.</div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.download = `Flowmatics_Report_${Date.now()}.html`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onUpdateItemRef = useRef(onUpdateItem);
  onUpdateItemRef.current = onUpdateItem;

  const handleAutoLayout = useCallback(() => {
    if (items.length === 0) return;

    const containerWidth = canvasRef.current?.clientWidth || 1200;
    const MARGIN = 20;
    const GAP = 16;
    const COLS = 2;
    const CARD_H = 140;
    const CHART_H = 340;
    // Snap everything to GRID_SIZE
    const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;

    // Separate metric KPI cards from regular charts
    const metrics = items.filter(i => i.type === 'metric');
    const charts = items.filter(i => i.type !== 'metric');

    // Available width for charts
    const totalPadding = MARGIN * 2 + GAP * (COLS - 1);
    const slotWidth = snap(Math.floor((containerWidth - totalPadding) / COLS));

    // --- Row 0: Metric cards spread across top ---
    const metricSlotW = metrics.length > 0
      ? snap(Math.floor((containerWidth - MARGIN * 2 - GAP * (metrics.length - 1)) / metrics.length))
      : 0;

    metrics.forEach((item, i) => {
      onUpdateItem(item.id, {
        x: snap(MARGIN + i * (metricSlotW + GAP)),
        y: snap(MARGIN),
        width: metricSlotW,
        height: snap(CARD_H),
      });
    });

    const chartsStartY = metrics.length > 0 ? snap(MARGIN + CARD_H + GAP) : snap(MARGIN);

    // --- Rows 1+: Regular charts in 2-column grid ---
    charts.forEach((item, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      onUpdateItem(item.id, {
        x: snap(MARGIN + col * (slotWidth + GAP)),
        y: chartsStartY + snap(row * (CHART_H + GAP)),
        width: slotWidth,
        height: snap(CHART_H),
      });
    });
  }, [items, onUpdateItem]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current || isLocked) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + canvasRef.current.scrollLeft;
      const mouseY = e.clientY - rect.top + canvasRef.current.scrollTop;

      if (draggingId) {
        const currentItem = itemsRef.current.find(i => i.id === draggingId);
        if (!currentItem || currentItem.isLocked) return;

        let newX = mouseX - dragOffset.x;
        let newY = mouseY - dragOffset.y;

        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

        onUpdateItemRef.current(draggingId, { x: Math.max(0, newX), y: Math.max(0, newY) });
      } else if (resizingId) {
        const currentItem = itemsRef.current.find(i => i.id === resizingId);
        if (!currentItem || currentItem.isLocked) return;

        const deltaX = e.clientX - startMouse.x;
        const deltaY = e.clientY - startMouse.y;

        let newWidth = initialDim.w + deltaX;
        let newHeight = initialDim.h + deltaY;

        newWidth = Math.round(newWidth / GRID_SIZE) * GRID_SIZE;
        newHeight = Math.round(newHeight / GRID_SIZE) * GRID_SIZE;

        onUpdateItemRef.current(resizingId, {
          width: Math.max(240, newWidth),
          height: Math.max(240, newHeight)
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setResizingId(null);
      setAlignmentGuides([]);
    };

    if (draggingId || resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingId, dragOffset, startMouse, initialDim, isLocked]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-50 dark:bg-surface-900 transition-colors">
      <header className="h-16 border-b border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-50 transition-colors">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-3 tracking-tight leading-none">
            Workbench
            {isLocked && <div className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-bold rounded-md border border-amber-500/20 uppercase tracking-widest">Locked</div>}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 opacity-60" />
            <p className="text-[10px] text-surface-400 dark:text-surface-500 font-bold uppercase tracking-widest">{items.length} Active Modules</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-900 p-1 rounded-xl shadow-inner border border-surface-200 dark:border-surface-700">
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isLocked ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-300'}`}
            >
              {isLocked ? <><Lock className="w-3.5 h-3.5" /> Locked</> : <><Unlock className="w-3.5 h-3.5" /> Fluid</>}
            </button>
            <div className="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-1"></div>
            <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-all ${showGrid ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-surface-400 hover:bg-white dark:hover:bg-surface-700'}`} title="Toggle Grid"><Grid3X3 className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="px-4 py-2 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-xl border border-surface-200 dark:border-surface-700 transition-all flex items-center gap-2 shadow-sm active:scale-95 text-[10px] font-bold uppercase tracking-wider"
            >
              <ImageIcon className={`w-3.5 h-3.5 ${isExporting ? 'animate-pulse' : ''}`} />
              {isExporting ? 'Capturing...' : 'Image'}
            </button>
            <button
              onClick={handleExportHTML}
              className="px-4 py-2 bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-white text-white dark:text-surface-900 rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-95 text-[10px] font-bold uppercase tracking-wider"
            >
              <FileCode className="w-3.5 h-3.5" />
              Report
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onUndo} className="p-2.5 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 text-surface-400 hover:text-indigo-600 transition-all shadow-sm"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={handleAutoLayout} className="p-2.5 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 text-surface-400 hover:text-indigo-600 transition-all shadow-sm" title="Auto-Layout"><LayoutGrid className="w-4 h-4" /></button>
          </div>

          <button
            onClick={onAutoGenerate}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 ml-2"
          >
            <Sparkles className="w-4 h-4 text-white/50" />
            Auto-Insights
          </button>
        </div>
      </header>

      <div ref={canvasRef} id="dashboard-grid" className={`flex-1 overflow-auto relative bg-surface-50 dark:bg-surface-900/50 ${showGrid ? 'canvas-grid' : ''}`} style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}>

        {items.map(item => {
          const isDragging = draggingId === item.id;
          const isResizing = resizingId === item.id;
          const isEditing = editingId === item.id;

          return (
            <div
              key={item.id}
              className={`absolute flex flex-col group transition-[box-shadow,transform] duration-200 ${isDragging ? 'z-[999] opacity-70' : ''}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                zIndex: item.zIndex || 10,
                transition: isDragging || isResizing ? 'none' : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div
                onMouseDown={(e) => {
                  if (isLocked || item.isLocked) return;
                  const rect = canvasRef.current!.getBoundingClientRect();
                  setDraggingId(item.id);
                  setDragOffset({ x: e.clientX - rect.left + canvasRef.current!.scrollLeft - item.x, y: e.clientY - rect.top + canvasRef.current!.scrollTop - item.y });
                }}
                className={`h-11 flex items-center justify-between px-4 bg-white/90 dark:bg-surface-800/90 backdrop-blur-md rounded-t-2xl border-x border-t border-surface-200 dark:border-surface-700 shadow-sm ${isLocked || item.isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className={`w-4 h-4 text-surface-200 dark:text-surface-600 ${!isLocked && !item.isLocked ? 'group-hover:text-indigo-400' : ''}`} />
                  <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest truncate max-w-[160px]">{item.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-2 rounded-lg text-surface-400 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all">
                    {expandedId === item.id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => onUpdateItem(item.id, { isLocked: !item.isLocked })} className={`p-2 rounded-lg transition-all ${item.isLocked ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-surface-400 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-700'}`}>{item.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
                  <button onClick={() => setEditingId(isEditing ? null : item.id)} className={`p-2 rounded-lg transition-all ${isEditing ? 'text-indigo-600 bg-indigo-50 dark:bg-surface-700 border border-indigo-100' : 'text-surface-400 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-700'}`}><Settings2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onRemoveItem(item.id)} className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className={`flex-1 min-h-0 relative bg-white/60 dark:bg-surface-800/60 backdrop-blur-sm border border-surface-200 dark:border-surface-700 rounded-b-2xl shadow-material transition-all p-7 overflow-hidden ${isDragging ? 'ring-2 ring-indigo-500/20 shadow-material-hover' : ''}`}>
                <button
                  onClick={() => onAskAboutChart(item.title)}
                  className="absolute top-4 right-4 z-50 p-2 bg-white/80 dark:bg-surface-700/80 backdrop-blur-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  title="Ask AI about this chart"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                {item.type === 'metric' ? (
                  <MetricCard
                    title={item.title}
                    value={(processChartData(data, item)[0])?.value?.toLocaleString() ?? '0'}
                    isDarkMode={isDarkMode}
                    growth={item.growth}
                    subValue={item.subValue}
                    subLabel={item.subLabel}
                  />
                ) : (
                  <DashboardChart item={item} data={data} isDarkMode={isDarkMode} />
                )}

                {isEditing && (
                  <div className="absolute inset-0 z-50 bg-white/98 dark:bg-surface-800/98 backdrop-blur-sm p-7 overflow-y-auto animate-slide-up custom-scrollbar text-xs">
                    <div className="flex items-center justify-between mb-8 pb-3 border-b border-surface-100 dark:border-surface-700">
                      <h4 className="font-bold text-surface-900 dark:text-white uppercase tracking-widest text-base">Module Logic</h4>
                      <button onClick={() => setEditingId(null)} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl transition-all"><X className="w-5 h-5 text-surface-400" /></button>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest mb-2 ml-1">Header Title</label>
                        <input type="text" value={item.title} onChange={(e) => onUpdateItem(item.id, { title: e.target.value })} className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-3 text-surface-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest mb-2 ml-1">Aggregate</label>
                          <select value={item.aggregation || 'sum'} onChange={(e) => onUpdateItem(item.id, { aggregation: e.target.value as AggregationType })} className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-3 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20">
                            <option value="sum">Sum</option><option value="avg">Avg</option><option value="count">Count</option><option value="min">Min</option><option value="max">Max</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest mb-2 ml-1">Ordering</label>
                          <select value={item.sortByValue || 'none'} onChange={(e) => onUpdateItem(item.id, { sortByValue: e.target.value as SortOrder })} className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-3 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20">
                            <option value="none">Default</option><option value="asc">Ascending</option><option value="desc">Descending</option>
                          </select>
                        </div>
                      </div>
                      <button onClick={() => setEditingId(null)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Commit Changes</button>
                    </div>
                  </div>
                )}
              </div>

              {!isLocked && !item.isLocked && (
                <div
                  onMouseDown={(e) => { e.stopPropagation(); setResizingId(item.id); setStartMouse({ x: e.clientX, y: e.clientY }); setInitialDim({ w: item.width, h: item.height }); }}
                  className="absolute bottom-3 right-3 w-8 h-8 cursor-se-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  <div className="w-3.5 h-3.5 border-r-2 border-b-2 border-indigo-500/50 rounded-sm"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedId && (
        <div className="fixed inset-0 z-[2000] bg-surface-950/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
          <div className="w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-surface-800 rounded-[3rem] shadow-2xl border border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden relative">
            <div className="h-20 flex items-center justify-between px-12 border-b border-surface-100 dark:border-surface-700 shrink-0">
              <h3 className="text-xl font-bold dark:text-white uppercase tracking-widest">
                {items.find(i => i.id === expandedId)?.title}
              </h3>
              <button onClick={() => setExpandedId(null)} className="p-4 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-2xl transition-all">
                <X className="w-6 h-6 text-surface-400" />
              </button>
            </div>
            <div className="flex-1 p-12 min-h-0">
              {(() => {
                const item = items.find(i => i.id === expandedId);
                return item ? <DashboardChart item={item} data={data} isDarkMode={isDarkMode} /> : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};