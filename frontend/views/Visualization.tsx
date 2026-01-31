
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Label, ScatterChart, Scatter, ZAxis, Tooltip, LabelList
} from 'recharts';
import { 
  Download, Plus, ChevronDown, Check, Activity, Palette, Zap, Sparkles, 
  LayoutGrid, Settings2, RotateCcw, Type as TypeIcon, ChevronLeft, ChevronRight,
  Maximize2, Sliders, Box, Layers, MousePointer2, X, Filter, ListFilter, Trash2
} from 'lucide-react';
import { ChartConfig, DataRow, ThemeType, AggregationType, SortOrder } from '../types';
import { processChartData } from '../utils/chartUtils';

interface VisualizationProps {
  data: DataRow[];
  headers: string[];
  config: ChartConfig;
  isDarkMode: boolean;
  setConfig: (config: ChartConfig) => void;
  onAddToDashboard: (config: ChartConfig) => void;
  activeFilters: Record<string, any[]>;
  setActiveFilters: (filters: Record<string, any[]>) => void;
}

export const CHART_THEMES: Record<ThemeType, string[]> = {
  default: ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'],
  neon: ['#00f2ff', '#7000ff', '#ff007a', '#00ff41', '#fbff00'],
  pastel: ['#ffd1dc', '#b19cd9', '#aec6cf', '#ffb347', '#77dd77'],
  dark: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'],
  professional: ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
};

export const Visualization: React.FC<VisualizationProps> = ({ 
  data, headers, config, isDarkMode, setConfig, onAddToDashboard, activeFilters, setActiveFilters 
}) => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showYSelection, setShowYSelection] = useState(false);
  const [segmentColumn, setSegmentColumn] = useState<string>('');
  
  const themeColors = useMemo(() => {
    const base = CHART_THEMES[config.theme || 'default'] || CHART_THEMES.default;
    if (config.color) {
      return [config.color, ...base.filter(c => c !== config.color)].slice(0, 8);
    }
    return base;
  }, [config.color, config.theme]);

  // Unique values for categorical selection (Data Segmenter)
  const segmentValues = useMemo(() => {
    if (!segmentColumn) return [];
    const values = Array.from(new Set(data.map(r => r[segmentColumn])));
    return values.sort((a, b) => String(a).localeCompare(String(b))).slice(0, 50);
  }, [data, segmentColumn]);

  // Active chart data applying global filters
  const chartData = useMemo(() => processChartData(data, config), [data, config]);

  const handleYToggle = (key: string) => {
    const current = config.yAxisKeys || [];
    const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    setConfig({ ...config, yAxisKeys: updated });
  };

  const handleSegmentToggle = (column: string, value: any) => {
    const currentValues = activeFilters[column] || [];
    let newValues;
    if (currentValues.includes(value)) {
      newValues = currentValues.filter((v: any) => v !== value);
    } else {
      newValues = [...currentValues, value];
    }

    const newFilters = { ...activeFilters };
    if (newValues.length === 0) {
      delete newFilters[column];
    } else {
      newFilters[column] = newValues;
    }
    setActiveFilters(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  const formatYAxis = (value: any) => {
    if (typeof value !== 'number') return value;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value;
  };

  const renderChart = () => {
    if (!config.xAxisKey) return (
      <div className="h-full flex flex-col items-center justify-center text-surface-400 bg-surface-50/50 dark:bg-surface-800/20 rounded-[3rem] border-2 border-dashed border-surface-200 dark:border-surface-700 transition-colors">
        <Sparkles className="w-16 h-16 mb-8 opacity-10 animate-pulse text-indigo-500" />
        <p className="text-sm font-black uppercase tracking-[0.3em] text-surface-400 dark:text-surface-500">Initialize Dimensions</p>
        <p className="text-[10px] text-surface-300 dark:text-surface-600 mt-4 font-bold tracking-widest uppercase text-center max-w-xs">Select an X-Axis column in the Architect panel</p>
      </div>
    );

    const hasY = config.yAxisKeys && config.yAxisKeys.length > 0;
    const common = { margin: { top: 40, right: 40, left: 20, bottom: 40 }, data: chartData };
    
    const axisColor = isDarkMode ? '#475569' : '#94a3b8';
    const tickStyle = { fontSize: 10, fill: axisColor, fontWeight: 600, fontFamily: 'JetBrains Mono' };
    const labelStyle = { 
      fill: isDarkMode ? '#64748b' : '#cbd5e1', 
      fontSize: 9, 
      fontWeight: 800, 
      textTransform: 'uppercase' as const, 
      letterSpacing: '0.2em' 
    };

    const dataLabelProps = config.showLabels ? {
      fill: config.labelColor || (isDarkMode ? '#ffffff' : '#334155'),
      fontSize: config.labelFontSize || 10,
      fontWeight: 700,
      position: 'top' as any,
      offset: 12
    } : null;

    const chartUI = (
      <>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} />
        <XAxis 
            dataKey={config.type === 'scatter' || config.type === 'bubble' ? "x" : "name"} 
            tick={tickStyle} 
            tickLine={false} 
            axisLine={{ stroke: isDarkMode ? '#1e293b' : '#f1f5f9' }} 
            height={50}
        >
            <Label value={config.xAxisKey} position="insideBottom" offset={-15} style={labelStyle} />
        </XAxis>
        <YAxis 
            tick={tickStyle} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={formatYAxis}
            width={75}
        >
             <Label value={hasY ? (config.yAxisKeys.length === 1 ? config.yAxisKeys[0] : 'Metric') : 'Count'} angle={-90} position="insideLeft" offset={0} style={{ ...labelStyle, textAnchor: 'middle' }} />
        </YAxis>
        <Tooltip 
            cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
            contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px' }}
            itemStyle={{ fontSize: '11px', fontWeight: 700 }}
            labelStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', color: '#94a3b8' }}
        />
        {config.showLabels && <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', paddingBottom: '30px' }} />}
      </>
    );

    switch(config.type) {
      case 'bar': return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...common}>
            {chartUI}
            {hasY ? config.yAxisKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={themeColors[i % themeColors.length]} radius={[8, 8, 0, 0]} barSize={40}>
                {config.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
              </Bar>
            )) : (
              <Bar dataKey="value" name="Count" fill={themeColors[0]} radius={[8, 8, 0, 0]} barSize={40}>
                {config.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      );
      case 'line': return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...common}>
            {chartUI}
            {hasY ? config.yAxisKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={themeColors[i % themeColors.length]} strokeWidth={4} dot={config.showLabels ? { r: 5, fill: themeColors[i % themeColors.length], strokeWidth: 2, stroke: isDarkMode ? '#0f172a' : '#fff' } : false} activeDot={{ r: 7 }} strokeLinecap="round">
                {config.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
              </Line>
            )) : (
              <Line type="monotone" dataKey="value" name="Count" stroke={themeColors[0]} strokeWidth={4} dot={config.showLabels} strokeLinecap="round">
                {config.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
              </Line>
            )}
          </LineChart>
        </ResponsiveContainer>
      );
      case 'area': return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart {...common}>
            {chartUI}
            <defs>
              {themeColors.map((color, i) => (
                <linearGradient key={i} id={`colorGradient${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            {hasY ? config.yAxisKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={themeColors[i % themeColors.length]} fill={`url(#colorGradient${i})`} strokeWidth={3} strokeLinecap="round">
                {config.showLabels && <LabelList dataKey={key} {...dataLabelProps} />}
              </Area>
            )) : (
              <Area type="monotone" dataKey="value" name="Count" stroke={themeColors[0]} fill={`url(#colorGradient0)`} strokeWidth={3} strokeLinecap="round">
                {config.showLabels && <LabelList dataKey="value" {...dataLabelProps} />}
              </Area>
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
      case 'pie': 
      case 'doughnut': return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={chartData} 
              cx="50%" cy="50%" 
              outerRadius="80%" 
              innerRadius={config.type === 'doughnut' ? '65%' : '0'} 
              dataKey={hasY ? config.yAxisKeys[0] : "value"} 
              nameKey="name" 
              stroke={isDarkMode ? '#0f172a' : '#ffffff'} 
              strokeWidth={4}
              label={config.showLabels ? { fill: isDarkMode ? '#fff' : '#333', fontSize: 11, fontWeight: 700 } : false}
            >
              {chartData.map((_, i) => <Cell key={i} fill={themeColors[i % themeColors.length]} />)}
            </Pie>
            <Tooltip 
                contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
      default: return null;
    }
  };

  return (
    <div className="flex h-full bg-surface-50 dark:bg-surface-950 overflow-hidden relative transition-colors">
      <button 
        onClick={() => setShowSidebar(!showSidebar)}
        className={`absolute top-1/2 -translate-y-1/2 z-50 w-6 h-24 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-400 hover:text-indigo-600 shadow-xl transition-all ${showSidebar ? 'left-80 rounded-r-2xl border-l-0' : 'left-0 rounded-r-2xl border-l-0'}`}
      >
        {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className={`h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 transition-all duration-500 ease-in-out overflow-hidden flex flex-col shrink-0 ${showSidebar ? 'w-80' : 'w-0 opacity-0'}`}>
        <div className="p-8 flex flex-col h-full space-y-8 custom-scrollbar overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
                <Settings2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-black text-sm text-surface-900 dark:text-white leading-none mb-1.5 uppercase tracking-widest">Architect</h3>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.15em]">Core Engine</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="relative">
              <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 mb-3 tracking-widest ml-1">Visualization Model</label>
              <button 
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="w-full flex items-center justify-between bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 rounded-2xl px-5 py-3.5 text-xs font-bold text-surface-700 dark:text-surface-200 hover:bg-white dark:hover:bg-surface-800 transition-all"
              >
                <div className="flex items-center gap-3">
                   <Box className="w-4 h-4 text-indigo-500" />
                   <span className="capitalize">{config.type}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
              </button>
              {showModelMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowModelMenu(false)}></div>
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-material-hover z-40 p-2 animate-slide-up">
                    {['bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'bubble'].map(t => (
                      <button 
                        key={t} onClick={() => { setConfig({...config, type: t as any}); setShowModelMenu(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all capitalize ${config.type === t ? 'bg-indigo-600 text-white' : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700'}`}
                      >
                        <Layers className="w-4 h-4 opacity-40" /> {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6 pt-4 border-t border-surface-100 dark:border-surface-800">
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 tracking-widest ml-1">X Axis (Dimension)</label>
                <select 
                  value={config.xAxisKey} onChange={(e) => setConfig({...config, xAxisKey: e.target.value})}
                  className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-5 py-3.5 text-xs font-bold text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="" disabled>Select Column...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="space-y-3 relative">
                <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 tracking-widest ml-1">Y Axis (Measure)</label>
                <button 
                  onClick={() => setShowYSelection(!showYSelection)}
                  className="w-full flex items-center justify-between bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-5 py-3.5 text-xs font-bold text-surface-700 dark:text-surface-200 hover:bg-white dark:hover:bg-surface-800 transition-all"
                >
                  <span className="truncate">{config.yAxisKeys.length > 0 ? `${config.yAxisKeys.length} Measures` : 'Global Count'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showYSelection ? 'rotate-180' : ''}`} />
                </button>
                {showYSelection && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowYSelection(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-material-hover z-40 p-2 max-h-64 overflow-y-auto animate-slide-up custom-scrollbar">
                      <button onClick={() => { setConfig({...config, yAxisKeys: []}); setShowYSelection(false); }} className="w-full text-left px-4 py-3 text-[11px] font-black uppercase text-surface-400 hover:bg-surface-50 rounded-xl transition-all mb-1">Row Count (Frequency)</button>
                      <div className="h-px bg-surface-100 dark:bg-surface-700 my-2"></div>
                      {headers.map(h => (
                        <button key={h} onClick={() => handleYToggle(h)} className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold rounded-xl transition-all mb-0.5 ${config.yAxisKeys.includes(h) ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700'}`}>
                            <span className="truncate">{h}</span>
                            {config.yAxisKeys.includes(h) && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* DATA SEGMENTER / SUB-VALUES */}
            <div className="space-y-6 pt-4 border-t border-surface-100 dark:border-surface-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 tracking-widest ml-1">Data Segmenter</label>
                  {Object.keys(activeFilters).length > 0 && (
                    <button onClick={clearAllFilters} className="text-[9px] font-black text-red-500 uppercase hover:underline flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                <select 
                  value={segmentColumn} onChange={(e) => setSegmentColumn(e.target.value)}
                  className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl px-5 py-3.5 text-xs font-bold text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select Column to Filter...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {segmentColumn && (
                <div className="animate-slide-up space-y-3">
                  <p className="text-[9px] font-bold text-surface-400 uppercase tracking-widest ml-1">Available Sub-values</p>
                  <div className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 max-h-48 overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
                    {segmentValues.map(val => (
                      <button 
                        key={String(val)}
                        onClick={() => handleSegmentToggle(segmentColumn, val)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                          (activeFilters[segmentColumn] || []).includes(val)
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                            : 'bg-white dark:bg-surface-900 border-surface-100 dark:border-surface-700 text-surface-500 hover:border-indigo-400'
                        }`}
                      >
                        {val === null ? 'null' : String(val)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Segments Preview */}
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(activeFilters).map(([col, vals]) => (
                  <div key={col} className="w-full">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 ml-1">{col}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(vals as any[]).map(v => (
                        <div key={String(v)} className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                          {String(v)}
                          <X className="w-3 h-3 cursor-pointer hover:scale-125 transition-transform" onClick={() => handleSegmentToggle(col, v)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-surface-100 dark:border-surface-800">
               <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 mb-4 tracking-widest ml-1">Accent Palette</label>
               <div className="flex flex-wrap gap-2.5">
                 {CHART_THEMES.default.map(color => (
                   <button
                     key={color}
                     onClick={() => setConfig({ ...config, color })}
                     className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${config.color === color ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent shadow-sm'}`}
                     style={{ backgroundColor: color }}
                   />
                 ))}
               </div>
            </div>

            <div className="space-y-5 pt-8 border-t border-surface-100 dark:border-surface-800">
               <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-[10px] font-black text-surface-400 dark:text-surface-500 group-hover:text-surface-900 dark:group-hover:text-white transition-colors uppercase tracking-widest">Data Labels</span>
                  <input type="checkbox" checked={config.showLabels || false} onChange={(e) => setConfig({...config, showLabels: e.target.checked})} className="sr-only peer" />
                  <div className="w-10 h-5 bg-surface-100 dark:bg-surface-800 rounded-full peer peer-checked:bg-indigo-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
               </label>
            </div>
          </div>
          
          <div className="mt-auto pt-8">
             <button 
              onClick={() => onAddToDashboard(config)}
              disabled={!config.xAxisKey}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-20 shadow-xl shadow-indigo-600/20"
             >
               <Plus className="w-5 h-5" /> Pin to Desk
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-12 transition-all duration-500 ease-in-out flex flex-col min-w-0">
        <div className="flex-1 bg-white dark:bg-surface-900 rounded-[4rem] border border-surface-200 dark:border-surface-800 p-16 shadow-soft flex flex-col relative overflow-hidden transition-all duration-500">
           <div className="flex justify-between items-start mb-16 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-surface-50 dark:bg-surface-800 rounded-[2rem] flex items-center justify-center border border-surface-100 dark:border-surface-700 shadow-sm transition-transform hover:scale-105">
                    <LayoutGrid className="w-8 h-8 text-indigo-500" />
                 </div>
                 <div>
                    <h2 className="text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mb-3">
                       {config.xAxisKey ? config.title : 'Synaptic Studio'}
                    </h2>
                    <div className="flex items-center gap-3 text-surface-400 font-bold tracking-widest">
                       <Activity className="w-4 h-4 text-indigo-600" />
                       <p className="text-[11px] uppercase">Interrogation Console</p>
                    </div>
                 </div>
              </div>
              <div className="flex gap-3">
                 <button className="p-5 text-surface-400 hover:text-indigo-600 bg-surface-50 dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700 transition-all hover:shadow-soft active:scale-90">
                    <Download className="w-7 h-7" />
                 </button>
              </div>
           </div>

           <div className="flex-1 min-h-0 relative z-10 animate-slide-up">
              {renderChart()}
           </div>

           <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[150px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2"></div>
           <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[150px] pointer-events-none rounded-full -translate-x-1/2 translate-y-1/2"></div>
        </div>
      </div>
    </div>
  );
};
