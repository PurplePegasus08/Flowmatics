import React, { useState, useEffect } from 'react';
import { Cloud, Cpu, Check, AlertCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { apiClient } from '../services/apiClient';

interface LLMProvider {
    available: boolean;
    model: string;
    url?: string;
}

interface LLMStatus {
    active_provider: string;
    providers: {
        gemini: LLMProvider;
        ollama: LLMProvider;
    };
}

interface LLMSelectorProps {
    isCollapsed?: boolean;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({ isCollapsed = false }) => {
    const { activeProvider, setActiveProvider } = useData();
    const [providers, setProviders] = useState<LLMStatus['providers'] | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const data = await apiClient.getLLMStatus();
            setProviders(data.providers);
            setActiveProvider(data.active_provider);
        } catch (error) {
            console.error('Failed to fetch LLM status:', error);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const switchProvider = async (provider: 'gemini' | 'ollama') => {
        setLoading(true);
        try {
            const data = await apiClient.switchLLMProvider(provider);
            setProviders(data.providers.providers); // The backend returns {status, provider, providers: {...}}
            setActiveProvider(data.provider);
        } catch (error) {
            console.error('Provider switch failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!providers) return null;

    const active = activeProvider;

    if (isCollapsed) {
        return (
            <div className="flex flex-col items-center gap-2 py-2">
                <button
                    onClick={() => switchProvider(active === 'gemini' ? 'ollama' : 'gemini')}
                    disabled={loading || (active === 'gemini' && !providers.ollama.available)}
                    className={`p-2 rounded-xl transition-all ${active === 'gemini' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'}`}
                    title={active === 'gemini' ? 'Switch to Local (Ollama)' : 'Switch to Cloud (Gemini)'}
                >
                    {active === 'gemini' ? <Cloud className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                </button>
            </div>
        );
    }

    return (
        <div className="p-3">
            <div className="flex flex-col gap-2 bg-surface-50 dark:bg-surface-900/50 p-2 rounded-xl border border-surface-100 dark:border-surface-700/50">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Model Sync</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${providers.ollama.available ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                </div>

                <div className="grid grid-cols-2 gap-1 px-0.5">
                    <button
                        onClick={() => switchProvider('gemini')}
                        disabled={loading}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${active === 'gemini' ? 'bg-white dark:bg-surface-700 text-indigo-600 shadow-sm ring-1 ring-surface-200 dark:ring-surface-600' : 'text-surface-400 hover:text-surface-600'}`}
                    >
                        <Cloud className="w-3 h-3" />
                        Cloud
                    </button>
                    <button
                        onClick={() => switchProvider('ollama')}
                        disabled={loading || !providers.ollama.available}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${active === 'ollama' ? 'bg-white dark:bg-surface-700 text-emerald-600 shadow-sm ring-1 ring-surface-200 dark:ring-surface-600' : 'text-surface-400 hover:text-surface-600'} ${!providers.ollama.available && 'opacity-30'}`}
                    >
                        <Cpu className="w-3 h-3" />
                        Local
                    </button>
                </div>

                <div className="px-1 text-center">
                    <p className="text-[9px] font-bold text-surface-500 truncate mt-1">
                        {active === 'gemini' ? 'Gemini 2.5 Flash' : `Kimi K2.5 (Ollama)`}
                    </p>
                </div>
            </div>
        </div>
    );
};
