import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardItem, DataRow, AggregationType, SortOrder, LegendPosition } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Label, Legend, ScatterChart, Scatter, ZAxis, Tooltip, LabelList, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap, ComposedChart, Rectangle } from 'recharts';
import { Trash2, Download, Lock, Unlock, Grid3X3, RotateCcw, Settings2, X, Type, Gauge, Hash, SlidersHorizontal, GripVertical, LayoutTemplate, Activity, Maximize2, Minimize2, LayoutGrid, Sparkles, Image as ImageIcon, FileCode, Share2, Palette } from 'lucide-react';
import { CHART_THEMES } from './Visualization';
import { processChartData } from '../utils/chartUtils';
import { InsightCard } from '../components/InsightCard';

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
        <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">{label}</p>
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
              <stop offset="0%" stopColor={item.color || colors[0]} stopOpacity={1} />
              <stop offset="100%" stopColor={item.color || colors[0]} stopOpacity={0.6} />
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
            <Line key={key} type={lineType} dataKey={key} stroke={item.color || colors[i % colors.length]} dot={item.showLabels} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Line>
          )) : (
            <Line type={lineType} dataKey="value" stroke={item.color || colors[0]} dot={item.showLabels} strokeWidth={3} strokeLinecap="round">
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
              <Cell key={`cell-${index}`} fill={index === 0 && item.color ? item.color : colors[index % colors.length]} />
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
            <Area key={key} type={lineType} stackId={item.stacked ? "stack" : undefined} dataKey={key} stroke={item.color || colors[i % colors.length]} fill={`url(#areaGradient-${item.id})`} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Area>
          )) : (
            <Area type={lineType} dataKey="value" stroke={item.color || colors[0]} fill={`url(#areaGradient-${item.id})`} strokeWidth={3} strokeLinecap="round">
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
  return null;
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
    const dashboardHtml = document.getElementById('dashboard-grid')?.innerHTML;
    if (!dashboardHtml) return;

    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Flowmatics Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: ${isDarkMode ? '#020617' : '#f8fafc'}; color: ${isDarkMode ? '#fff' : '#000'}; font-family: sans-serif; padding: 40px; }
    .grid-stack { position: relative; }
    .grid-stack-item { background: ${isDarkMode ? 'rgba(15,23,42,0.6)' : '#fff'}; border-radius: 24px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 0.2em;">Flowmatics Intelligence Report</h1>
  <div class="grid-stack">${dashboardHtml}</div>
  <p style="margin-top: 40px; font-size: 10px; opacity: 0.5;">Generated by Flowmatics AI</p>
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

    const containerWidth = canvasRef.current?.offsetWidth || 1200;
    const margin = 40;
    const padding = 20;
    const itemWidth = Math.min(500, (containerWidth - (margin * 2) - padding) / 2);
    const itemHeight = 400;

    items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      const newX = margin + (col * (itemWidth + padding));
      const newY = margin + (row * (itemHeight + padding));

      onUpdateItem(item.id, {
        x: Math.round(newX / GRID_SIZE) * GRID_SIZE,
        y: Math.round(newY / GRID_SIZE) * GRID_SIZE,
        width: Math.round(itemWidth / GRID_SIZE) * GRID_SIZE,
        height: Math.round(itemHeight / GRID_SIZE) * GRID_SIZE
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

      <div ref={canvasRef} className={`flex-1 overflow-auto relative bg-surface-50 dark:bg-surface-900/50 ${showGrid ? 'canvas-grid' : ''}`} style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px` }}>

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
                <DashboardChart item={item} data={data} isDarkMode={isDarkMode} />

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