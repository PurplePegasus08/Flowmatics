import React, { useRef } from 'react';
import { RefreshCw, AlertTriangle, Sparkles, Download, Loader } from 'lucide-react';

interface PlotlyDashboardProps {
    html: string | null;
    isLoading: boolean;
    error: string | null;
    isDarkMode: boolean;
    onGenerate: () => void;
}

const LOADING_MESSAGES = [
    'Profiling your dataset…',
    'Crafting optimal chart types…',
    'Building interactive Plotly visualizations…',
    'Designing KPI cards…',
    'Finalizing dashboard layout…',
];

function LoadingPulse() {
    const [msgIdx, setMsgIdx] = React.useState(0);

    React.useEffect(() => {
        const t = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 1800);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full gap-8 select-none">
            {/* Animated ring */}
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 animate-spin" />
                <div className="absolute inset-3 rounded-full border-[3px] border-transparent border-t-violet-500 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <h3 className="text-xl font-bold text-surface-900 dark:text-white tracking-tight">
                    Generating AI Dashboard
                </h3>
                <p className="text-sm text-indigo-500 dark:text-indigo-400 font-semibold animate-pulse min-h-[20px]">
                    {LOADING_MESSAGES[msgIdx]}
                </p>
                <p className="text-xs text-surface-400 dark:text-surface-500 font-medium max-w-xs text-center">
                    The LLM is analyzing your data and building interactive Plotly charts. This may take 15–40 seconds.
                </p>
            </div>

            {/* Dots indicator */}
            <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-indigo-500"
                        style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                    />
                ))}
            </div>
        </div>
    );
}

function EmptyState({ onGenerate, isDarkMode }: { onGenerate: () => void; isDarkMode: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-8 select-none">
            {/* Illustration */}
            <div className="relative">
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-14 h-14 text-indigo-400 opacity-80" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <span className="text-white text-xs font-black">AI</span>
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <h3 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight text-center">
                    Plotly AI Dashboard
                </h3>
                <p className="text-sm text-surface-500 dark:text-surface-400 font-medium max-w-sm text-center leading-relaxed">
                    Let the LLM analyze your dataset and generate a complete interactive dashboard with Plotly.js — featuring bar charts, line charts, pie charts, scatter plots, KPI cards, and more.
                </p>
            </div>

            <div className="flex flex-col items-center gap-3">
                <button
                    onClick={onGenerate}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-2xl shadow-indigo-500/30 transition-all active:scale-95 hover:shadow-indigo-500/50"
                >
                    <Sparkles className="w-5 h-5" />
                    Generate Plotly Dashboard
                </button>
                <p className="text-[10px] text-surface-400 font-medium uppercase tracking-wider">
                    Powered by Gemini AI
                </p>
            </div>
        </div>
    );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 select-none">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="text-center max-w-sm">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Generation Failed</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">{error}</p>
            </div>
            <button
                onClick={onRetry}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-95"
            >
                <RefreshCw className="w-4 h-4" />
                Try Again
            </button>
        </div>
    );
}

export const PlotlyDashboard: React.FC<PlotlyDashboardProps> = ({
    html,
    isLoading,
    error,
    isDarkMode,
    onGenerate,
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleDownload = () => {
        if (!html) return;
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.download = `Flowmatics_PlotlyDashboard_${Date.now()}.html`;
        a.href = URL.createObjectURL(blob);
        a.click();
    };

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            {/* Sub-toolbar — only shown when a dashboard is rendered */}
            {html && !isLoading && (
                <div className="shrink-0 flex items-center justify-between px-6 py-2 border-b border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-800/60 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        LLM-Generated Plotly Dashboard
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onGenerate}
                            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-surface-700 hover:bg-surface-50 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                            <Download className="w-3 h-3" />
                            Download HTML
                        </button>
                    </div>
                </div>
            )}

            {/* Main content area */}
            <div className="flex-1 min-h-0 relative">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-50 dark:bg-surface-900">
                        <LoadingPulse />
                    </div>
                )}
                {!isLoading && error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-50 dark:bg-surface-900">
                        <ErrorState error={error} onRetry={onGenerate} />
                    </div>
                )}
                {!isLoading && !error && !html && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-50 dark:bg-surface-900">
                        <EmptyState onGenerate={onGenerate} isDarkMode={isDarkMode} />
                    </div>
                )}
                {/* Always render iframe when html is available — keep it mounted to avoid remounts */}
                {html && (
                    <iframe
                        ref={iframeRef}
                        srcDoc={html}
                        sandbox="allow-scripts allow-same-origin"
                        title="Plotly AI Dashboard"
                        className="w-full h-full border-none block"
                        style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.4s ease' }}
                    />
                )}
            </div>
        </div>
    );
};
