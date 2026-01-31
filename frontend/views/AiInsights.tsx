import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Send, Sparkles, Loader2, User, Code2, Terminal, Play, CheckCircle2,
    ChevronDown, ChevronUp, BrainCircuit, PanelRightClose, PanelRightOpen,
    BarChart3, Maximize2, X, ChevronLeft, ChevronRight, PieChart as PieIcon,
    LineChart as LineIcon, Activity, LayoutGrid, Palette, Save, MousePointer2,
    ScatterChart as ScatterIcon, Table as TableIcon, Eraser
} from 'lucide-react';
import { DataRow, ChatMessage, ChartConfig, ThemeType } from '../types';
import { getGeminiResponse } from '../services/geminiService';
import { getApiUrl } from '../config';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
    ScatterChart, Scatter, ZAxis
} from 'recharts';
import { processChartData } from '../utils/chartUtils';
import { CHART_THEMES } from './Visualization';

interface AiInsightsProps {
    data: DataRow[];
    headers: string[];
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    onUpdateVisualization: (config: ChartConfig) => void;
    onCleanData: (column: string, operation: string) => void;
    onAddToDashboard: (config: ChartConfig) => void;
    sessionId: string;
}

const PythonCodeBlock = ({ script, explanation, sessionId }: { script: string, explanation: string, sessionId: string }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [hasExecuted, setHasExecuted] = useState(false);
    const [showOutput, setShowOutput] = useState(true);
    const [output, setOutput] = useState<string>("");

    const handleRun = async () => {
        setIsExecuting(true);
        try {
            const res = await fetch(getApiUrl('/api/repl/' + sessionId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            });
            const data = await res.json();
            if (data.type === 'error') {
                setOutput(`Error: ${data.text}`);
            } else {
                setHasExecuted(true);
                setOutput(data.text + (data.sample ? `\nSample:\n${JSON.stringify(data.sample, null, 2)}` : ''));
            }
        } catch (e) {
            setOutput(`Execution failed: ${e}`);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="my-6 border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden bg-slate-900 shadow-2xl max-w-full">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="ml-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                        <Code2 className="w-4 h-4" /> Python Logic Engine
                    </span>
                </div>
                <button
                    onClick={handleRun}
                    disabled={isExecuting || hasExecuted}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${hasExecuted
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20'
                        }`}
                >
                    {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hasExecuted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    {isExecuting ? 'Processing' : hasExecuted ? 'Validated' : 'Run Script'}
                </button>
            </div>
            <div className="p-6 font-mono text-xs text-slate-300 overflow-x-auto custom-scrollbar leading-relaxed bg-black/40">
                <pre>{script}</pre>
            </div>
            <div className="bg-slate-800/50 p-4 border-t border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2"><Terminal className="w-3 h-3" /> Synthesis Output</p>
                    <button onClick={() => setShowOutput(!showOutput)} className="text-slate-500 hover:text-white transition-colors">{showOutput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                </div>
                {showOutput && (
                    <div className="bg-black/40 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-slate-100 border border-slate-700 animate-fade-in">
                        {isExecuting ? <div className="text-indigo-400 animate-pulse">Initializing Neural Core...</div> : hasExecuted ? <div className="border-l-4 border-indigo-500 pl-4 py-1 whitespace-pre-wrap">{output || explanation}</div> : <div className="text-slate-500 italic">Engine Standby.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

// Enhanced Chart Component for Live Board
const LiveChart = ({ config, data }: { config: ChartConfig, data: DataRow[] }) => {
    const chartData = useMemo(() => processChartData(data, config), [data, config]);
    const colors = useMemo(() => {
        const base = CHART_THEMES[config.theme || 'default'];
        if (config.color) return [config.color, ...base];
        return base;
    }, [config.theme, config.color]);

    // Support for Tabular Data
    if (config.type === 'table') {
        const columns = [config.xAxisKey, ...(config.yAxisKeys || [])].filter(Boolean);
        const tableData = data.slice(0, 100); // Limit preview to 100 rows

        return (
            <div className="h-full w-full overflow-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700 z-10">
                        <tr>
                            <th className="p-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-300 tracking-wider">#</th>
                            {columns.map(col => (
                                <th key={col} className="p-3 text-[10px] font-black uppercase text-slate-500 dark:text-slate-300 tracking-wider">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                        {tableData.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-3 font-mono text-xs text-slate-400">{i + 1}</td>
                                {columns.map(col => (
                                    <td key={`${i}-${col}`} className="p-3 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                        {String(row[col])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-2 text-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    Showing first 100 rows
                </div>
            </div>
        );
    }

    const renderContent = () => {
        const commonProps = { data: chartData, margin: { top: 10, right: 10, left: 0, bottom: 0 } };
        const hasY = config.yAxisKeys && config.yAxisKeys.length > 0;
        const dataKey = hasY ? config.yAxisKeys[0] : 'value';

        switch (config.type) {
            case 'bar': return (
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                    <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} animationDuration={500} />
                </BarChart>
            );
            case 'line': return (
                <LineChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }} />
                    <Line type="monotone" dataKey={dataKey} stroke={colors[0]} strokeWidth={3} dot={false} animationDuration={500} />
                </LineChart>
            );
            case 'area': return (
                <AreaChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }} />
                    <Area type="monotone" dataKey={dataKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} animationDuration={500} />
                </AreaChart>
            );
            case 'pie':
            case 'doughnut': return (
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey={dataKey}
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        innerRadius={config.type === 'doughnut' ? 60 : 0}
                        fill={colors[0]}
                        paddingAngle={2}
                    >
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }} />
                </PieChart>
            );
            case 'scatter':
            case 'bubble': return (
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis type="number" dataKey="x" name={config.xAxisKey} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="y" name={hasY ? config.yAxisKeys[0] : 'Value'} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    {config.type === 'bubble' && <ZAxis type="number" dataKey="z" range={[50, 400]} />}
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }} />
                    <Scatter name={config.title} data={chartData} fill={colors[0]} animationDuration={500} />
                </ScatterChart>
            );
            default: return <div className="flex items-center justify-center h-full text-slate-400 text-xs">Chart type optimized for Studio view</div>;
        }
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            {renderContent()}
        </ResponsiveContainer>
    );
};

export const AiInsights: React.FC<AiInsightsProps> = ({
    data, headers, messages, setMessages, onUpdateVisualization, onCleanData, onAddToDashboard, sessionId
}) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Enhanced Live Board State
    const [showLivePanel, setShowLivePanel] = useState(false);
    const [chartHistory, setChartHistory] = useState<ChartConfig[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentChartConfig = chartHistory[currentIndex];

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, loading]);

    // Handle panel close - no longer clears history
    const handleClosePanel = () => {
        setShowLivePanel(false);
    };

    const handleClearHistory = () => {
        setChartHistory([]);
        setCurrentIndex(0);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const contextStr = `Total records: ${data.length}. Sample data: ${JSON.stringify(data.slice(0, 3))}. Available columns: ${headers.join(', ')}.`;
            const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model' as any, parts: [{ text: m.content }] }));
            history.push({ role: 'user', parts: [{ text: input }] });

            const response = await getGeminiResponse(history, contextStr, undefined, sessionId);
            const content = response.text;
            const toolCalls = response.functionCalls;

            if (content) setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content }]);
            if (toolCalls) {
                for (const call of toolCalls) {
                    const args = call.args as any;
                    if (call.name === 'runPythonAnalysis') {
                        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `PYTHON_CODE_BLOCK:${JSON.stringify({ script: args.script, explanation: args.explanation })}`, isToolOutput: true }]);
                    } else if (call.name === 'generateVisualization') {
                        const newConfig: ChartConfig = {
                            id: Date.now().toString(),
                            title: args.title,
                            type: args.type as any, // allow 'table'
                            xAxisKey: args.xAxisKey,
                            yAxisKeys: args.yAxisKey ? [args.yAxisKey] : [],
                            theme: 'default',
                            aggregation: 'sum'
                        };

                        // Update History
                        setChartHistory(prev => {
                            const next = [...prev, newConfig];
                            // Schedule index update after render
                            setTimeout(() => setCurrentIndex(next.length - 1), 0);
                            return next;
                        });
                        setShowLivePanel(true);

                        const responseMsg = args.type === 'table'
                            ? `I've displayed the raw data for "${args.xAxisKey}" in the Live Board.`
                            : `I've rendered the "${args.title}" chart in the Live Board for you.`;

                        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: responseMsg, isToolOutput: true }]);
                    }
                }
            }
        } catch (e) {
            console.error("Chat Error:", e);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `Neural communication interrupted. Details: ${e instanceof Error ? e.message : String(e)}` }]);
        } finally {
            setLoading(false);
        }
    };

    // Local Actions
    const handleUpdateCurrent = (updates: Partial<ChartConfig>) => {
        if (!currentChartConfig) return;
        setChartHistory(prev => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], ...updates };
            return next;
        });
    };

    const handleNext = () => setCurrentIndex(prev => Math.min(prev + 1, chartHistory.length - 1));
    const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

    const toggleTheme = () => {
        if (!currentChartConfig) return;
        const themes: ThemeType[] = ['default', 'neon', 'pastel', 'dark', 'professional'];
        const currentIdx = themes.indexOf(currentChartConfig.theme || 'default');
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        handleUpdateCurrent({ theme: nextTheme });
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 relative transition-colors duration-300 overflow-hidden">
            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col relative transition-all duration-500 ${showLivePanel ? 'w-2/3' : 'w-full'}`}>
                {/* Header Toggle for Live Board */}
                <div className="absolute top-4 right-8 z-40">
                    <button
                        onClick={() => showLivePanel ? handleClosePanel() : setShowLivePanel(true)}
                        className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all active:scale-95 flex items-center gap-2"
                        title={showLivePanel ? "Close Live Board" : "Open Live Board"}
                    >
                        {showLivePanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                        {!showLivePanel && <span className="text-xs font-bold uppercase tracking-wider pr-1">Live Board</span>}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 pb-40 space-y-12 custom-scrollbar" ref={scrollRef}>
                    {messages.length === 1 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                            <div className="w-24 h-24 bg-indigo-600/10 rounded-[3rem] flex items-center justify-center mb-8 shadow-inner ring-1 ring-indigo-500/20">
                                <BrainCircuit className="w-12 h-12 text-indigo-500 animate-pulse" />
                            </div>
                            <p className="font-black uppercase tracking-[0.4em] text-[12px] mb-2">Cognitive Processor Active</p>
                            <p className="text-[10px] font-medium tracking-widest text-slate-500">Awaiting Data Interrogation...</p>
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isPython = msg.content.startsWith('PYTHON_CODE_BLOCK:');
                        let pythonData = null;
                        if (isPython) { try { pythonData = JSON.parse(msg.content.replace('PYTHON_CODE_BLOCK:', '')); } catch (e) { } }

                        return (
                            <div key={msg.id} className={`flex gap-8 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-12 h-12 rounded-[1.25rem] flex-shrink-0 flex items-center justify-center shadow-2xl transition-all ${msg.role === 'user' ? 'bg-white dark:bg-slate-800 text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700' : 'bg-indigo-600 text-white shadow-indigo-600/30'}`}>
                                    {msg.role === 'user' ? <User className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                                </div>
                                <div className={`p-8 rounded-[2.5rem] max-w-[85%] text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none font-medium'
                                    : isPython
                                        ? 'bg-transparent p-0 border-none max-w-full w-full'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-tl-none border border-slate-100 dark:border-slate-800'
                                    }`}>
                                    {isPython && pythonData ? <PythonCodeBlock script={pythonData.script} explanation={pythonData.explanation} sessionId={sessionId} /> : msg.content}
                                </div>
                            </div>
                        );
                    })}
                    {loading && (
                        <div className="flex gap-8 animate-pulse items-center">
                            <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20">
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-48"></div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-5xl px-12 z-30">
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl border border-white dark:border-slate-800 p-4 rounded-[2.5rem] flex items-center gap-4 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] transition-all">
                        <input
                            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Analyze global dataset with Intelligence..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-base font-medium px-8 text-slate-900 dark:text-white placeholder:text-slate-500 outline-none"
                        />
                        <button
                            onClick={handleSend} disabled={loading || !input.trim()}
                            className="w-16 h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.75rem] transition-all shadow-2xl shadow-indigo-600/30 active:scale-90 flex items-center justify-center disabled:opacity-30 disabled:grayscale"
                        >
                            <Send className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Enhanced Live Data Board Panel */}
            <div
                className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-500 ease-in-out flex flex-col ${showLivePanel ? 'w-[40%] translate-x-0 opacity-100' : 'w-0 translate-x-full opacity-0'}`}
            >
                <div className="h-20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Live Board</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Real-time Visualization</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearHistory}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg text-slate-400 transition-colors"
                            title="Clear Board History"
                        >
                            <Eraser className="w-4 h-4" />
                        </button>
                        <button onClick={handleClosePanel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden relative bg-slate-50/50 dark:bg-slate-950/50 flex flex-col">
                    {currentChartConfig ? (
                        <div className="h-full flex flex-col animate-slide-up">

                            {/* History Navigation */}
                            <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentIndex === 0}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Viz {currentIndex + 1} / {chartHistory.length}
                                </span>
                                <button
                                    onClick={handleNext}
                                    disabled={currentIndex === chartHistory.length - 1}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Chart Container */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col min-h-0">
                                <div className="flex justify-between items-start mb-6 shrink-0">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white truncate pr-4">{currentChartConfig.title}</h4>
                                    <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">
                                        {currentChartConfig.type}
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0 w-full overflow-hidden">
                                    <LiveChart config={currentChartConfig} data={data} />
                                </div>
                            </div>

                            {/* Interactive Controls (Hidden for Table) */}
                            {currentChartConfig.type !== 'table' && (
                                <div className="mt-4 grid grid-cols-6 gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    {['bar', 'line', 'area', 'pie', 'scatter', 'bubble'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => handleUpdateCurrent({ type: type as any })}
                                            className={`flex items-center justify-center p-2 rounded-xl transition-all ${currentChartConfig.type === type ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                            title={type}
                                        >
                                            {type === 'bar' && <BarChart3 className="w-4 h-4" />}
                                            {type === 'line' && <LineIcon className="w-4 h-4" />}
                                            {type === 'area' && <Activity className="w-4 h-4" />}
                                            {type === 'pie' && <PieIcon className="w-4 h-4" />}
                                            {(type === 'scatter' || type === 'bubble') && <ScatterIcon className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-4 flex gap-3 shrink-0">
                                <button
                                    onClick={toggleTheme}
                                    className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center shadow-sm"
                                    title="Cycle Theme"
                                >
                                    <Palette className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => onAddToDashboard(currentChartConfig)}
                                    className="flex-1 py-4 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Pin
                                </button>
                                <button
                                    onClick={() => onUpdateVisualization(currentChartConfig)}
                                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Maximize2 className="w-4 h-4" /> Studio
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
                            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-bold">No Active Visualization</p>
                            <p className="text-xs mt-2 opacity-60">Ask the AI to "visualize" data or "show columns" to see them here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};