import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../config';

interface InsightCardProps {
    sessionId: string;
    dataLoaded: boolean;
}

export const InsightCard: React.FC<InsightCardProps> = ({ sessionId, dataLoaded }) => {
    const [insights, setInsights] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!dataLoaded || sessionId === 'default') {
            setInsights([]);
            return;
        }

        const fetchSummary = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(getApiUrl(`/api/insights/summary/${sessionId}`));
                if (!res.ok) throw new Error('Failed to generate insights');
                const data = await res.json();
                setInsights(data.insights || []);
            } catch (e) {
                console.error('Insight generation error:', e);
                setError('Unable to generate insights');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [sessionId, dataLoaded]);

    if (!dataLoaded) return null;

    return (
        <div className="mx-auto max-w-6xl px-8 pt-8 animate-slide-up">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200/50 dark:border-indigo-800/50 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white">Executive Snapshot</h3>
                        <p className="text-[10px] text-surface-500 dark:text-surface-400 font-bold uppercase tracking-widest">AI-Generated Summary</p>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Analyzing data patterns...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 py-4">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {!loading && !error && insights.length > 0 && (
                    <div className="space-y-4">
                        {insights.map((insight, idx) => (
                            <div key={idx} className="flex gap-4 items-start group">
                                <div className="mt-1 w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed font-medium">
                                    {insight}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
