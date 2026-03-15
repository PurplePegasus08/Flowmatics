import React from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

export interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    unit?: string;
    icon?: 'activity' | 'hash' | 'percent' | 'layers';
    isDarkMode?: boolean;
    subValue?: string | number;
    subLabel?: string;
    growth?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title, value, change, unit, icon, isDarkMode, subValue, subLabel, growth
}) => {
    const isPositive = growth !== undefined ? growth >= 0 : (change !== undefined ? change >= 0 : true);

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</span>
                    <Activity className="w-3 h-3 text-slate-300" />
                </div>
                <div className="flex items-baseline gap-1">
                    {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
                    <h3 className={`text-2xl font-black tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {value}
                    </h3>
                </div>
            </div>

            <div className="flex items-end justify-between mt-auto pt-2">
                <div className="flex flex-col">
                    {subValue !== undefined && (
                        <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">{subLabel || 'PREV PERIOD'}</span>
                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">{subValue}</span>
                        </div>
                    )}
                </div>

                {(growth !== undefined || change !== undefined) && (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">GROWTH</span>
                        <div className={`flex items-center gap-0.5 font-black text-[11px] ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPositive ? '+' : ''}{growth ?? change}%
                            {isPositive ? <TrendingUp className="w-3" /> : <TrendingDown className="w-3" />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
