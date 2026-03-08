import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Info } from 'lucide-react';

type NotificationType = 'success' | 'info' | 'error';

interface NotificationData {
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<NotificationData | null>(null);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const notify = useCallback((message: string, type: NotificationType = 'info') => {
        setNotification({ message, type });
    }, []);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            {/* Superior Notification System - Moved from App.tsx */}
            {notification && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[100] animate-slide-up pointer-events-none">
                    <div className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl border backdrop-blur-2xl ${notification.type === 'success'
                            ? 'bg-white/80 dark:bg-slate-900/80 border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                            : notification.type === 'error'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                        <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-indigo-500 text-white' :
                                notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-500 text-white'
                            }`}>
                            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.15em]">{notification.message}</span>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};
