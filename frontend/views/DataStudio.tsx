import React, { useState, useMemo } from 'react';
import {
  Upload, Search, ChevronLeft, ChevronRight, X,
  Table as TableIcon, Activity, ShieldCheck, Zap,
  Hash, Columns, Check, ChevronDown, FilterX,
  Type, CheckSquare, Filter, Eraser,
  BarChart3, AlertCircle, Info, PieChart, ListFilter, Trash2
} from 'lucide-react';
import { DataRow } from '../types';

interface DataStudioProps {
  data: DataRow[];
  headers: string[];
  activeFilters: Record<string, any[]>;
  setActiveFilters: (filters: Record<string, any[]>) => void;
  onFileUpload: (file: File) => void;

  onCleanData: (operation: string, column?: string) => void; // Legacy, kept for compatibility if needed, but onProcessData is preferred
  onProcessData: (action: string, payload: any) => Promise<void>;
  onRemoveData: () => void;
}

export const DataStudio: React.FC<DataStudioProps> = ({
  data, headers, onFileUpload, onCleanData, onProcessData, activeFilters, setActiveFilters, onRemoveData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'table' | 'stats'>('table');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showSegmenter, setShowSegmenter] = useState(false);
  const [showProcessor, setShowProcessor] = useState(false); // New state for Processor menu
  const [processingAction, setProcessingAction] = useState<string | null>(null); // 'impute', 'outliers', etc.
  const [processingCol, setProcessingCol] = useState<string>('');
  const [processingStrategy, setProcessingStrategy] = useState<string>('mean');
  const [segmentColumn, setSegmentColumn] = useState<string>('');
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);

  const rowsPerPage = 50;

  // Initialize visible columns
  useMemo(() => {
    if (headers.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(headers);
    }
  }, [headers]);

  // Detected column types for better visualization
  const columnTypes = useMemo(() => {
    const map: Record<string, 'numeric' | 'categorical' | 'boolean'> = {};
    headers.forEach(h => {
      const nonNullValues = data.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
      if (nonNullValues.length === 0) {
        map[h] = 'categorical';
        return;
      }
      const numericValues = nonNullValues.filter(v => typeof v === 'number');
      const isNumeric = numericValues.length > (nonNullValues.length * 0.5);
      map[h] = isNumeric ? 'numeric' : (typeof nonNullValues[0] === 'boolean' ? 'boolean' : 'categorical');
    });
    return map;
  }, [data, headers]);

  // Data filtered by segments (used for Stats and as base for Table Search)
  const segmentedData = useMemo(() => {
    return data.filter(row => {
      return (Object.entries(activeFilters) as [string, any[]][]).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        return vals.includes(row[col]);
      });
    });
  }, [data, activeFilters]);

  // Master filtered data (Segments + Search, used for Table only)
  const filteredData = useMemo(() => {
    if (searchTerm === '') return segmentedData;
    return segmentedData.filter(row =>
      headers.some(h => String(row[h]).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [segmentedData, headers, searchTerm]);

  // Quality Statistics based on currently segmented data
  const columnStats = useMemo(() => {
    return headers.map(h => {
      const type = columnTypes[h];
      const allValues = segmentedData.map(r => r[h]);
      const validValues = allValues.filter(v => v !== null && v !== undefined && v !== '');
      const missingCount = allValues.length - validValues.length;
      const uniqueCount = new Set(allValues).size;
      const fillRate = allValues.length > 0 ? (validValues.length / allValues.length) * 100 : 0;

      // Type consistency check
      let matchesType = 0;
      if (validValues.length > 0) {
        validValues.forEach(v => {
          if (type === 'numeric' && !isNaN(Number(v))) matchesType++;
          else if (type === 'boolean' && (v === true || v === false || v === 'true' || v === 'false')) matchesType++;
          else if (type === 'categorical' && typeof v === 'string') matchesType++;
        });
      }
      const consistency = validValues.length > 0 ? (matchesType / validValues.length) * 100 : 100;

      let min = '-', max = '-';
      let reliability = 100;

      if (type === 'numeric') {
        const nums = validValues.map(v => Number(v)).filter(v => !isNaN(v));
        if (nums.length > 0) {
          min = Math.min(...nums).toLocaleString();
          max = Math.max(...nums).toLocaleString();

          // Reliability heuristic: check for zero variance or extreme outliers
          const range = Math.max(...nums) - Math.min(...nums);
          if (range === 0 && nums.length > 1) reliability -= 30; // low information
        }
      } else if (type === 'categorical') {
        // High cardinality in categoricals can be a reliability warning for some analyses
        if (uniqueCount > validValues.length * 0.95 && validValues.length > 10) reliability -= 10;
      }

      return {
        header: h,
        type,
        missing: missingCount,
        unique: uniqueCount,
        fillRate: fillRate.toFixed(1),
        consistency: consistency.toFixed(1),
        reliability: Math.max(0, reliability).toFixed(1),
        min,
        max
      };
    });
  }, [segmentedData, headers, columnTypes]);

  // Calculate overall data quality score with weighted breakdown
  const qualityBreakdown = useMemo(() => {
    if (columnStats.length === 0) return { score: 100, completeness: 100, consistency: 100, reliability: 100 };

    const completeness = columnStats.reduce((acc, s) => acc + Number(s.fillRate), 0) / columnStats.length;
    const consistency = columnStats.reduce((acc, s) => acc + Number(s.consistency), 0) / columnStats.length;
    const reliability = columnStats.reduce((acc, s) => acc + Number(s.reliability), 0) / columnStats.length;

    // Weights: 40% Completeness, 30% Consistency, 30% Reliability
    const weightedScore = (completeness * 0.4) + (consistency * 0.3) + (reliability * 0.3);

    return {
      score: Math.round(weightedScore),
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      reliability: Math.round(reliability)
    };
  }, [columnStats]);

  const overallQualityScore = qualityBreakdown.score;

  // Get unique values for dropdown filtering
  const uniqueValues = useMemo(() => {
    const map: Record<string, any[]> = {};
    headers.forEach(h => {
      const vals = Array.from(new Set(data.map(r => r[h])));
      map[h] = vals.sort((a, b) => String(a).localeCompare(String(b))).slice(0, 100);
    });
    return map;
  }, [data, headers]);

  const segmentValues = useMemo(() => {
    if (!segmentColumn) return [];
    return uniqueValues[segmentColumn] || [];
  }, [segmentColumn, uniqueValues]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const toggleFilterValue = (column: string, value: any) => {
    const currentValues = activeFilters[column] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    const newFilters = { ...activeFilters };
    if (newValues.length === 0) delete newFilters[column];
    else newFilters[column] = newValues;
    setActiveFilters(newFilters);
  };

  if (data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 h-full bg-surface-50 dark:bg-surface-900 transition-colors">
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-3xl p-20 text-center max-w-2xl w-full shadow-soft animate-slide-up">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-indigo-100 dark:border-indigo-500/20">
            <Upload className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-surface-900 dark:text-white mb-4">Ingest Data for Analysis</h3>
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-12 max-w-md mx-auto leading-relaxed">
            InsightFlow supports CSV and JSON formats. Once uploaded, our engine will map dimensions for instant discovery.
          </p>
          <label className="inline-flex items-center gap-3 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95">
            <span>Select Source File</span>
            <input type="file" className="hidden" accept=".csv,.json" onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-900 overflow-hidden relative transition-colors">
      <header className="h-16 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-6 bg-white dark:bg-surface-900 z-30 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex bg-surface-100 dark:bg-surface-800 p-1.5 rounded-xl border border-surface-200 dark:border-surface-700 relative group/quality">
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-surface-700 shadow-sm rounded-lg border border-surface-100 dark:border-surface-600 cursor-help">
              <ShieldCheck className={`w-4 h-4 ${overallQualityScore > 90 ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-surface-500 dark:text-surface-400">Data Quality:</span>
              <span className={`text-xs font-bold ${overallQualityScore > 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {overallQualityScore}%
              </span>
            </div>

            {/* Overall Score Breakdown Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-64 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl p-5 opacity-0 pointer-events-none group-hover/quality:opacity-100 transition-all duration-300 z-[100] transform origin-top scale-95 group-hover/quality:scale-100">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-4">Health Breakdown</h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-surface-600 dark:text-surface-300">Completeness</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{qualityBreakdown.completeness}%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-100 dark:bg-surface-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${qualityBreakdown.completeness}%` }}></div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-surface-600 dark:text-surface-300">Consistency</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{qualityBreakdown.consistency}%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-100 dark:bg-surface-900 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${qualityBreakdown.consistency}%` }}></div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-surface-600 dark:text-surface-300">Reliability</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{qualityBreakdown.reliability}%</span>
                  </div>
                  <div className="w-full h-1 bg-surface-100 dark:bg-surface-900 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${qualityBreakdown.reliability}%` }}></div>
                  </div>
                </div>
              </div>
              <p className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-700 text-[9px] text-surface-400 italic leading-relaxed">
                Score based on weighted analysis of missing values, type consistency, and distribution variance.
              </p>
            </div>
          </div>
          <button
            onClick={onRemoveData}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Dataset
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowSegmenter(!showSegmenter)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border rounded-xl shadow-sm ${showSegmenter ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 bg-white dark:bg-surface-800'}`}
            >
              <ListFilter className="w-4 h-4" />
              Segment
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showSegmenter ? 'rotate-180' : ''}`} />
            </button>
            {showSegmenter && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSegmenter(false)}></div>
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-3xl shadow-material-hover z-50 overflow-hidden animate-slide-up">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black uppercase text-surface-400 dark:text-surface-500 tracking-widest ml-1">Segment By</label>
                      {Object.keys(activeFilters).length > 0 && (
                        <button onClick={() => setActiveFilters({})} className="text-[9px] font-bold text-red-500 flex items-center gap-1 hover:underline">
                          <Trash2 className="w-3 h-3" /> Clear All
                        </button>
                      )}
                    </div>
                    <select
                      value={segmentColumn} onChange={(e) => setSegmentColumn(e.target.value)}
                      className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-700 rounded-xl px-4 py-3 text-xs font-bold text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Choose dimension...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>

                    {segmentColumn && (
                      <div className="animate-fade-in space-y-3">
                        <p className="text-[9px] font-bold text-surface-400 uppercase tracking-widest ml-1">Select values to isolate</p>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
                          {segmentValues.map(val => (
                            <button
                              key={String(val)}
                              onClick={() => toggleFilterValue(segmentColumn, val)}
                              className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${(activeFilters[segmentColumn] || []).includes(val)
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                                : 'bg-surface-50 dark:bg-surface-900 border-surface-100 dark:border-surface-700 text-surface-500 hover:border-indigo-400'
                                }`}
                            >
                              {val === null ? 'null' : String(val)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border rounded-xl shadow-sm ${showColumnSelector ? 'border-indigo-500 text-indigo-600' : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 bg-white dark:bg-surface-800'}`}
            >
              <Columns className="w-4 h-4" />
              Columns
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showColumnSelector ? 'rotate-180' : ''}`} />
            </button>
            {showColumnSelector && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnSelector(false)}></div>
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-material-hover z-50 overflow-hidden animate-slide-up">
                  <div className="px-4 py-3 bg-surface-50 dark:bg-surface-900/50 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Toggle Columns</span>
                    <button onClick={() => setVisibleColumns(headers)} className="text-[9px] font-bold text-indigo-600">Reset All</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                    {headers.map(h => (
                      <button
                        key={h}
                        onClick={() => toggleColumn(h)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-colors mb-0.5 ${visibleColumns.includes(h) ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-surface-600 hover:bg-surface-50'}`}
                      >
                        <span className="truncate pr-4">{h}</span>
                        {visibleColumns.includes(h) && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text" placeholder="Interrogate data..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl py-2 pl-11 pr-5 text-xs font-medium outline-none w-64 transition-all focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </header>

      {/* Active Segments Preview Bar */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="bg-surface-50 dark:bg-surface-950/50 border-b border-surface-200 dark:border-surface-800 px-6 py-2 flex flex-wrap gap-3 items-center animate-fade-in shrink-0">
          <span className="text-[9px] font-black text-surface-400 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-3 h-3" /> Active Segments:
          </span>
          {Object.entries(activeFilters).map(([col, vals]) => (
            <div key={col} className="flex items-center gap-1.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-2.5 py-1 rounded-lg shadow-sm">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">{col}:</span>
              <div className="flex gap-1">
                {(vals as any[]).map(v => (
                  <div key={String(v)} className="flex items-center gap-1 text-[10px] font-bold text-surface-700 dark:text-surface-200">
                    {String(v)}
                    <button onClick={() => toggleFilterValue(col, v)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setActiveFilters({})} className="text-[10px] font-black text-red-500 uppercase hover:underline ml-2">Clear All</button>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white dark:bg-surface-900 custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="sticky top-0 z-20">
            <tr className="bg-surface-50/90 dark:bg-surface-950/90 backdrop-blur-md border-b border-surface-200 dark:border-surface-700">
              {headers.filter(h => visibleColumns.includes(h)).map(h => {
                const type = columnTypes[h];
                const stats = columnStats.find(s => s.header === h);
                return (
                  <th key={h} className="px-8 py-5 text-[10px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 relative group cursor-help">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {type === 'numeric' ? <Hash className="w-3.5 h-3.5 opacity-40 text-indigo-500" /> : <Type className="w-3.5 h-3.5 opacity-40 text-indigo-500" />}
                        {h}
                      </div>
                    </div>

                    {/* Quality Tooltip */}
                    {stats && (
                      <div className="absolute left-1/2 -bottom-2 translate-y-full -translate-x-1/2 w-48 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-[100] text-left normal-case tracking-normal transform origin-top scale-95 group-hover:scale-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{type}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Number(stats.fillRate) > 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {stats.fillRate}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                          <div>
                            <p className="text-surface-400 font-medium">Missing</p>
                            <p className="font-mono font-bold text-surface-900 dark:text-white">{stats.missing.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-surface-400 font-medium">Unique</p>
                            <p className="font-mono font-bold text-surface-900 dark:text-white">{stats.unique.toLocaleString()}</p>
                          </div>
                          {type === 'numeric' && (
                            <>
                              <div className="col-span-2 mt-1 pt-2 border-t border-surface-100 dark:border-surface-700 grid grid-cols-2">
                                <div>
                                  <p className="text-surface-400 font-medium">Min</p>
                                  <p className="font-mono font-bold text-surface-700 dark:text-surface-300 truncate pr-2">{stats.min}</p>
                                </div>
                                <div>
                                  <p className="text-surface-400 font-medium">Max</p>
                                  <p className="font-mono font-bold text-surface-700 dark:text-surface-300 truncate">{stats.max}</p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-surface-800 border-l border-t border-surface-200 dark:border-surface-700 rotate-45"></div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                {headers.filter(h => visibleColumns.includes(h)).map(h => (
                  <td key={h} className="px-8 py-4 text-[13px] font-mono text-surface-600 dark:text-surface-400">
                    {row[h] === null ? <span className="text-surface-300 italic">null</span> : String(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="h-14 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between px-8 bg-white dark:bg-surface-950 shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-6 text-surface-500 text-[10px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Sync Active</span>
          <span>{filteredData.length.toLocaleString()} Records Visualized</span>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-20 transition-all"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-[10px] font-black font-mono px-4">{currentPage} / {totalPages}</div>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-20 transition-all"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </footer>
    </div>
  );
};