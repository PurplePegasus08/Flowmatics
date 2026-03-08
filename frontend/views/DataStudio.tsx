import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Upload, Search, ChevronLeft, ChevronRight, X,
  Table as TableIcon, Zap,
  Hash, Columns, Check, ChevronDown,
  Type, Filter,
  ListFilter, Trash2,
  Sparkles, BrainCircuit, Info,
  MoreVertical, Edit3, Trash, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, RotateCw, Download, Plus, Calculator
} from 'lucide-react';
import { DataRow } from '../types';
import { InsightCard } from '../components/InsightCard';

interface DataStudioProps {
  data: DataRow[];
  headers: string[];
  activeFilters: Record<string, any[]>;
  setActiveFilters: (filters: Record<string, any[]>) => void;
  onFileUpload: (file: File) => void;
  onCleanData: (operation: string, column?: string) => void;
  onProcessData: (action: string, payload: any) => Promise<any>;
  onRemoveData: () => void;
  onUndo: () => void;
  sessionId: string;
}

// Simple Mini-Histogram component for Micro-Sparklines
const MiniHistogram: React.FC<{ data: any[], type: string }> = ({ data, type }) => {
  const bins = useMemo(() => {
    if (type === 'numeric') {
      const nums = data.map(Number).filter(v => !isNaN(v));
      if (nums.length === 0) return [];
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (min === max) return [nums.length];
      const binCount = 8;
      const binWidth = (max - min) / binCount;
      const result = new Array(binCount).fill(0);
      nums.forEach(n => {
        const binIdx = Math.min(Math.floor((n - min) / binWidth), binCount - 1);
        result[binIdx]++;
      });
      return result;
    } else {
      const counts: Record<string, number> = {};
      data.forEach(v => { counts[String(v)] = (counts[String(v)] || 0) + 1; });
      return Object.values(counts).sort((a, b) => b - a).slice(0, 8);
    }
  }, [data, type]);

  if (bins.length === 0) return <div className="h-4 w-12 bg-surface-100 dark:bg-surface-800 rounded opacity-20"></div>;
  const maxBin = Math.max(...bins);

  return (
    <div className="flex items-end gap-0.5 h-4 w-12">
      {bins.map((val, i) => (
        <div
          key={i}
          className="bg-indigo-400/40 rounded-t-[1px] w-full"
          style={{ height: `${(val / maxBin) * 100}%` }}
        ></div>
      ))}
    </div>
  );
};

export const DataStudio: React.FC<DataStudioProps> = ({
  data, headers, onFileUpload, onProcessData, activeFilters, setActiveFilters, onRemoveData, onUndo, sessionId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'table'>('table');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showSegmenter, setShowSegmenter] = useState(false);
  const [showProcessor, setShowProcessor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [activeMenuColumn, setActiveMenuColumn] = useState<string | null>(null);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcName, setCalcName] = useState('');
  const [calcExpression, setCalcExpression] = useState('');

  const [segmentColumn, setSegmentColumn] = useState<string>('');
  const [lastReport, setLastReport] = useState<any[] | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [usePca, setUsePca] = useState(false);

  const rowsPerPage = 50;

  // Initialize visible columns
  useMemo(() => {
    if (headers.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(headers);
    }
  }, [headers]);

  // Detected column types
  const columnTypes = useMemo(() => {
    const map: Record<string, 'numeric' | 'categorical' | 'boolean'> = {};
    headers.forEach(h => {
      const nonNullValues = data.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
      if (nonNullValues.length === 0) {
        map[h] = 'categorical';
        return;
      }
      const numericValues = nonNullValues.filter(v => typeof v === 'number' || !isNaN(Number(v)));
      const isNumeric = numericValues.length > (nonNullValues.length * 0.5);
      map[h] = isNumeric ? 'numeric' : (typeof nonNullValues[0] === 'boolean' ? 'boolean' : 'categorical');
    });
    return map;
  }, [data, headers]);

  // Column Statistics
  const columnStats = useMemo(() => {
    const stats: Record<string, any> = {};
    headers.forEach(h => {
      const allValues = data.map(r => r[h]);
      const nonNullValues = allValues.filter(v => v !== null && v !== undefined && v !== '');
      const missingCount = allValues.length - nonNullValues.length;
      const missingPercent = (missingCount / allValues.length) * 100;

      const type = columnTypes[h];

      if (type === 'numeric') {
        const nums = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v));
        if (nums.length > 0) {
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          const max = Math.max(...nums);
          const min = Math.min(...nums);
          stats[h] = { type, missingPercent, mean, highest: max, lowest: min, count: nums.length, values: nums };
        } else {
          stats[h] = { type, missingPercent, count: 0, values: [] };
        }
      } else {
        const counts: Record<string, number> = {};
        nonNullValues.forEach(v => { counts[String(v)] = (counts[String(v)] || 0) + 1; });
        const uniqueCount = Object.keys(counts).length;
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        stats[h] = {
          type,
          missingPercent,
          uniqueCount,
          topValue: sorted[0]?.[0] || 'N/A',
          topCount: sorted[0]?.[1] || 0,
          values: nonNullValues
        };
      }
    });
    return stats;
  }, [data, headers, columnTypes]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key !== '' && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const type = columnTypes[sortConfig.key];
        if (type === 'numeric') {
          return sortConfig.direction === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
        }

        return sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return sortableItems;
  }, [data, sortConfig, columnTypes]);

  // Data filtered by segments
  const segmentedData = useMemo(() => {
    return sortedData.filter(row => {
      return (Object.entries(activeFilters) as [string, any[]][]).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        return vals.includes(row[col]);
      });
    });
  }, [sortedData, activeFilters]);

  // Master filtered data (Segments + Search)
  const filteredData = useMemo(() => {
    if (searchTerm === '') return segmentedData;
    return segmentedData.filter(row =>
      headers.some(h => String(row[h]).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [segmentedData, headers, searchTerm]);

  // Unique values for dropdown
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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key, direction });
  };

  const handleAction = async (action: string, payload: any) => {
    setIsProcessing(true);
    setLastReport(null);
    try {
      const res = await onProcessData(action, payload);
      if (res && res.report) {
        setLastReport(res.report);
        setShowReport(true);
      }
      setShowProcessor(false);
      setActiveMenuColumn(null);
      setShowCalcModal(false);
    } finally {
      setIsProcessing(false);
    }
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

  const exportData = (format: 'csv' | 'json') => {
    const content = format === 'csv'
      ? [headers.join(','), ...data.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n')
      : JSON.stringify(data, null, 2);

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insightflow_export_${sessionId.slice(0, 8)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
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
      {isProcessing && (
        <div className="absolute inset-0 z-[100] bg-white/60 dark:bg-surface-900/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-xs font-black uppercase text-indigo-600 tracking-widest animate-pulse">Repairing Vectors...</p>
        </div>
      )}
      <header className="h-16 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-6 bg-white dark:bg-surface-900 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onRemoveData}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>

          <div className="h-6 w-px bg-surface-200 dark:bg-surface-700 mx-1"></div>

          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              className="p-2 text-surface-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
              title="Undo Last Action"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-900 p-1 rounded-2xl border border-surface-200 dark:border-surface-700">
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'table' ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500 hover:text-surface-800 dark:text-surface-400'
                }`}
            >
              <TableIcon className="w-4 h-4" /> Table
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Insights Button */}
          <div className="relative">
            <button
              onClick={() => setShowAIInsights(!showAIInsights)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest transition-all border rounded-xl shadow-sm ${showAIInsights ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-indigo-600'}`}
            >
              <Sparkles className={`w-4 h-4 ${showAIInsights ? 'text-white/60' : 'text-indigo-500'}`} />
              Insights
            </button>
            {showAIInsights && (
              <>
                <div className="fixed inset-0 z-[190]" onClick={() => setShowAIInsights(false)}></div>
                <div className="absolute right-0 mt-4 w-[480px] z-[200] animate-slide-up origin-top-right">
                  <div className="relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-[2rem] shadow-2xl overflow-hidden p-1">
                    <div className="absolute top-4 right-4 z-10">
                      <button onClick={() => setShowAIInsights(false)} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-full transition-colors">
                        <X className="w-4 h-4 text-surface-400" />
                      </button>
                    </div>
                    <InsightCard sessionId={sessionId} dataLoaded={data.length > 0} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Segment/Filter button */}
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

          <button
            onClick={() => setShowCalcModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/30 rounded-xl transition-colors border border-emerald-100 dark:border-emerald-900/30 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Dimension
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProcessor(!showProcessor)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border rounded-xl shadow-sm ${showProcessor ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 bg-white dark:bg-surface-800'}`}
            >
              <Zap className="w-4 h-4" /> Cleanse
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showProcessor ? 'rotate-180' : ''}`} />
            </button>
            {showProcessor && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProcessor(false)}></div>
                <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-3xl shadow-material-hover z-50 overflow-hidden animate-slide-up p-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => handleAction('auto_clean', {})}
                      className="flex items-center gap-4 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Smart Optimize</span>
                        <span className="block text-[9px] text-slate-500">Auto-fix nulls & errors</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAction('remove_duplicates', {})}
                      className="flex items-center gap-4 p-3 rounded-2xl border border-red-50 dark:border-red-900/10 hover:border-red-500 hover:bg-red-50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20 group-hover:scale-110 transition-transform">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Remove Duplicates</span>
                        <span className="block text-[9px] text-slate-500">Deduplicate entire dataset</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        const col = prompt("Which column to fill missing values for? (Leave blank for all numeric)");
                        handleAction('impute', { columns: col ? [col] : headers, strategy: 'mean' });
                      }}
                      className="flex items-center gap-4 p-3 rounded-2xl border border-amber-50 dark:border-amber-900/10 hover:border-amber-500 hover:bg-amber-50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20 group-hover:scale-110 transition-transform">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Fill Missing</span>
                        <span className="block text-[9px] text-slate-500">Impute using column averages</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAction('prepare_for_ml', { usePca })}
                      className="flex items-center gap-4 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 group-hover:scale-110 transition-transform">
                        <BrainCircuit className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">ML Pipeline</span>
                        <span className="block text-[9px] text-slate-500">Scale & Encode dataset</span>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="p-2 text-surface-500 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-xl transition-all"
            >
              <Columns className="w-5 h-5" />
            </button>
            {showColumnSelector && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnSelector(false)}></div>
                <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up">
                  <div className="px-4 py-3 bg-surface-50 dark:bg-surface-900/50 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Toggle Columns</span>
                    <button onClick={() => setVisibleColumns(headers)} className="text-[9px] font-bold text-indigo-600">Reset</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                    {headers.map(h => (
                      <button
                        key={h}
                        onClick={() => toggleColumn(h)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl mb-0.5 ${visibleColumns.includes(h) ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : 'text-surface-600'}`}
                      >
                        <span className="truncate">{h}</span>
                        {visibleColumns.includes(h) && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => exportData('csv')} className="p-2 text-surface-500 hover:text-indigo-600 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-xl transition-all" title="Export CSV">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-4 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            <input
              type="text" placeholder="Interrogate data..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl py-2 pl-11 pr-5 text-xs font-medium outline-none w-48 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:w-64"
            />
          </div>
        </div>
      </header>

      {/* Active Segments Bar */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="bg-surface-50 dark:bg-surface-950/50 border-b border-surface-200 dark:border-surface-800 px-6 py-2 flex flex-wrap gap-3 items-center shrink-0">
          <span className="text-[9px] font-black text-surface-400 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-3 h-3" /> Filters:
          </span>
          {Object.entries(activeFilters).map(([col, vals]) => (
            <div key={col} className="flex items-center gap-1.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{col}:</span>
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
          <button onClick={() => setActiveFilters({})} className="text-[9px] font-black text-red-500 uppercase hover:underline">Clear All</button>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white dark:bg-surface-900 custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="sticky top-0 z-20">
            <tr className="bg-surface-50/90 dark:bg-surface-950/90 backdrop-blur-md border-b border-surface-200 dark:border-surface-700">
              {headers.filter(h => visibleColumns.includes(h)).map(h => {
                const type = columnTypes[h];
                const stats = columnStats[h];
                const isSorted = sortConfig.key === h;

                return (
                  <th key={h} className="px-6 py-4 relative group">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer select-none"
                          onClick={() => handleSort(h)}
                        >
                          {type === 'numeric' ? <Hash className="w-3 h-3 text-indigo-500 opacity-40" /> : <Type className="w-3 h-3 text-indigo-500 opacity-40" />}
                          <span className="text-[10px] font-black uppercase tracking-wider text-surface-500 dark:text-surface-400">{h}</span>
                          {isSorted && (sortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600" />)}
                          {!isSorted && <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-20" />}
                        </div>

                        <div className="flex items-center gap-1">
                          <div className="relative group/info">
                            <button className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md opacity-20 group-hover:opacity-100 transition-opacity">
                              <Info className="w-3.5 h-3.5 text-indigo-500" />
                            </button>

                            {/* Diagnostic Profile Tooltip - Fixed to trigger on Icon Hover only */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-60 p-4 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-300 z-[100] translate-y-2 group-hover/info:translate-y-0 backdrop-blur-xl">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100">
                                  {type === 'numeric' ? <Hash className="w-3 h-3 text-indigo-600" /> : <Type className="w-3 h-3 text-indigo-600" />}
                                </div>
                                <p className="text-[10px] font-black text-surface-900 dark:text-white uppercase truncate">{h}</p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-bold font-mono">
                                  <span className="text-surface-400 uppercase">Missing</span>
                                  <span className={stats?.missingPercent > 10 ? 'text-red-500' : 'text-emerald-500'}>{stats?.missingPercent?.toFixed(1)}%</span>
                                </div>
                                {type === 'numeric' ? (
                                  <>
                                    <div className="flex justify-between text-[9px] font-bold font-mono">
                                      <span className="text-surface-400 uppercase">Avg</span>
                                      <span className="text-indigo-600">{stats.mean?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-bold font-mono">
                                      <span className="text-surface-400 uppercase">Range</span>
                                      <span className="text-surface-600 dark:text-surface-300">{stats.lowest?.toLocaleString()} - {stats.highest?.toLocaleString()}</span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex justify-between text-[9px] font-bold font-mono">
                                      <span className="text-surface-400 uppercase">Unique</span>
                                      <span className="text-indigo-600">{stats.uniqueCount}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-bold font-mono pt-1 border-t border-surface-50">
                                      <span className="text-surface-400">Modal</span>
                                      <span className="text-surface-800 dark:text-white truncate max-w-[80px]">{stats.topValue}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveMenuColumn(activeMenuColumn === h ? null : h); }}
                              className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="w-3.5 h-3.5 text-surface-400" />
                            </button>

                            {activeMenuColumn === h && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setActiveMenuColumn(null)}></div>
                                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-2xl z-50 py-1 animate-scale-in origin-top-right">
                                  <button onClick={() => { const name = prompt('New name:', h); if (name) handleAction('rename_column', { oldName: h, newName: name }); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors uppercase">
                                    <Edit3 className="w-3.5 h-3.5" /> Rename
                                  </button>
                                  <div className="h-px bg-surface-100 dark:bg-surface-700 my-1"></div>
                                  <p className="px-3 py-1 text-[8px] font-black text-surface-400 uppercase tracking-tighter">Cast Type</p>
                                  <button onClick={() => handleAction('cast_type', { column: h, targetType: 'numeric' })} className="w-full flex items-center gap-2 px-3 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">Numeric</button>
                                  <button onClick={() => handleAction('cast_type', { column: h, targetType: 'string' })} className="w-full flex items-center gap-2 px-3 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">Categorical (ID/Label)</button>
                                  <div className="h-px bg-surface-100 dark:bg-surface-700 my-1"></div>
                                  <button onClick={() => handleAction('delete_column', { column: h })} className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase">
                                    <Trash className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Micro-Sparkline */}
                      <div className="flex items-center gap-2">
                        <MiniHistogram data={stats?.values || []} type={type} />
                        <span className={`text-[8px] font-black ${stats?.missingPercent > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {stats?.missingPercent === 0 ? '100%' : `${(100 - stats.missingPercent).toFixed(0)}%`}
                        </span>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                {headers.filter(h => visibleColumns.includes(h)).map(h => {
                  const val = row[h];
                  const stats = columnStats[h];
                  const type = columnTypes[h];

                  // Cell formatting & color coding
                  let cellClass = "px-6 py-3 text-[12px] font-mono ";
                  let content = val === null ? <span className="text-surface-300 italic">null</span> : String(val);

                  // Color coding: Nulls
                  if (val === null || val === undefined || val === '') {
                    cellClass += "bg-amber-50/20 dark:bg-amber-900/5 ";
                  }

                  // Color coding: Outliers for numeric
                  if (type === 'numeric' && val !== null) {
                    const num = Number(val);
                    if (stats.highest && num === stats.highest) cellClass += "text-emerald-600 font-bold ";
                    if (stats.lowest && num === stats.lowest) cellClass += "text-red-500 font-bold ";
                  }

                  return (
                    <td key={h} className={cellClass}>
                      <span className="truncate block max-w-[200px]" title={String(val)}>{content}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="h-14 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between px-8 bg-white dark:bg-surface-950 shrink-0 z-10">
        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-surface-400">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Connected</span>
          <span>{filteredData.length.toLocaleString()} Records Active</span>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-20"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-[10px] font-black font-mono px-4">{currentPage} / {totalPages}</div>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-20"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </footer>

      {/* Calculated Column Modal */}
      {showCalcModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowCalcModal(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Calculator className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">New Dimension</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Calculated Column Builder</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-sm">Column Name</label>
                <input
                  type="text" value={calcName} onChange={e => setCalcName(e.target.value)} placeholder="e.g. TotalMargin"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expression (Pandas eval)</label>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4">
                  <textarea
                    value={calcExpression} onChange={e => setCalcExpression(e.target.value)} placeholder="Price * Quantity * (1 - Discount)"
                    className="w-full bg-transparent text-sm font-mono focus:ring-0 outline-none h-24 resize-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {headers.slice(0, 6).map(h => (
                      <button key={h} onClick={() => setCalcExpression(prev => prev + h)} className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-[9px] font-bold text-slate-500 hover:text-emerald-600 transition-colors">{h}</button>
                    ))}
                    {headers.length > 6 && <span className="text-[9px] text-slate-400 flex items-center">+{headers.length - 6} more</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowCalcModal(false)} className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button
                onClick={() => handleAction('calculate_column', { newName: calcName, expression: calcExpression })}
                disabled={!calcName || !calcExpression}
                className="flex-1 py-3 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                Create Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Log Modal (Existing) */}
      {showReport && lastReport && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowReport(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-indigo-600" /> Decision Log
              </h3>
              <button onClick={() => setShowReport(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
              {lastReport.map((entry, i) => (
                <div key={i} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20"><Check className="w-4 h-4 text-white" /></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-indigo-600 tracking-tighter mb-1">{entry.action}</h4>
                    <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{entry.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};