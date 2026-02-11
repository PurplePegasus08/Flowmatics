import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardItem, DataRow, AggregationType, SortOrder, LegendPosition } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Label, Legend, ScatterChart, Scatter, ZAxis, Tooltip, LabelList } from 'recharts';
import { Trash2, Download, Lock, Unlock, Grid3X3, RotateCcw, Settings2, X, Type, Gauge, Hash, SlidersHorizontal, GripVertical, LayoutTemplate, Activity, Maximize2, LayoutGrid, Sparkles } from 'lucide-react';
import { CHART_THEMES } from './Visualization';
import { processChartData } from '../utils/chartUtils';

interface DashboardProps {
  data: DataRow[];
  headers: string[];
  isDarkMode: boolean;
  items: DashboardItem[];
  onUpdateItem: (id: string, updates: Partial<DashboardItem>) => void;
  onRemoveItem: (id: string) => void;

  onNavigateToData: () => void;
  onAutoGenerate: () => void;
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
          {chartAxes}
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId={item.stacked ? "stack" : undefined} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]}>
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Bar>
          )) : (
            <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]}>
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
          {chartAxes}
          {hasYAxis ? item.yAxisKeys.map((key, i) => (
            <Area key={key} type={lineType} stackId={item.stacked ? "stack" : undefined} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.1} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
            </Area>
          )) : (
            <Area type={lineType} dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.1} strokeWidth={3} strokeLinecap="round">
              {item.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
            </Area>
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (item.type === 'scatter' || item.type === 'bubble') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={margin}>
          {chartAxes}
          {item.type === 'bubble' && <ZAxis type="number" dataKey="z" range={[40, 200]} name="Size" />}
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '10px' }} />
          <Scatter name={yAxisLabel} data={chartData} fill={colors[0]}>
            {item.showLabels && <LabelList dataKey="y" {...dataLabelProps} />}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    )
  }
  return null;
});

export const Dashboard: React.FC<DashboardProps> = ({ data, headers, isDarkMode, items, onUpdateItem, onRemoveItem, onNavigateToData, onAutoGenerate }) => {
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
      <header className="h-16 border-b border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-20 transition-colors">
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

        <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-900 p-1 rounded-xl shadow-inner border border-surface-200 dark:border-surface-700 transition-colors">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isLocked ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-300'}`}
          >
            {isLocked ? <><Lock className="w-3.5 h-3.5" /> Immutable</> : <><Unlock className="w-3.5 h-3.5" /> Dynamic</>}
          </button>
          <div className="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-1"></div>
          <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-all ${showGrid ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-surface-400 hover:bg-white dark:hover:bg-surface-700'}`} title="Toggle Canvas Map"><Grid3X3 className="w-4.5 h-4.5" /></button>
          <button onClick={handleAutoLayout} className="p-2 rounded-lg text-surface-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-surface-700 transition-all" title="Auto-Align Items"><LayoutGrid className="w-4.5 h-4.5" /></button>
          <button onClick={() => { items.forEach(i => onRemoveItem(i.id)); }} className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-white dark:hover:bg-surface-700 transition-all" title="Purge Workspace"><RotateCcw className="w-4.5 h-4.5" /></button>
          <button
            onClick={() => (window as any).html2canvas && (window as any).html2canvas(canvasRef.current).then((c: any) => { const l = document.createElement('a'); l.download = 'insightflow_workbench.png'; l.href = c.toDataURL(); l.click(); })}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-md ml-2"
          >
            <Download className="w-4 h-4" /> Snapshot
          </button>
          <button
            onClick={onAutoGenerate}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow-md ml-2"
          >
            <Sparkles className="w-4 h-4" /> Auto-Generate
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
                className={`h-11 flex items-center justify-between px-4 bg-white dark:bg-surface-800 rounded-t-2xl border-x border-t border-surface-200 dark:border-surface-700 shadow-sm ${isLocked || item.isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className={`w-4 h-4 text-surface-200 dark:text-surface-600 ${!isLocked && !item.isLocked ? 'group-hover:text-indigo-400' : ''}`} />
                  <span className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest truncate max-w-[160px]">{item.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button onClick={() => onUpdateItem(item.id, { isLocked: !item.isLocked })} className={`p-2 rounded-lg transition-all ${item.isLocked ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-surface-400 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-700'}`}>{item.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
                  <button onClick={() => setEditingId(isEditing ? null : item.id)} className={`p-2 rounded-lg transition-all ${isEditing ? 'text-indigo-600 bg-indigo-50 dark:bg-surface-700 border border-indigo-100' : 'text-surface-400 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-700'}`}><Settings2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onRemoveItem(item.id)} className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className={`flex-1 min-h-0 relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-b-2xl shadow-material transition-all p-7 overflow-hidden ${isDragging ? 'ring-2 ring-indigo-500/20 shadow-material-hover' : ''}`}>
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

                      <div className="pt-4 border-t border-surface-100 dark:border-surface-700 space-y-4">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Show Labels</span>
                          <input type="checkbox" checked={item.showLabels || false} onChange={(e) => onUpdateItem(item.id, { showLabels: e.target.checked })} className="sr-only peer" />
                          <div className="w-9 h-5 bg-surface-200 dark:bg-surface-900 rounded-full peer peer-checked:bg-indigo-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
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
    </div>
  );
};