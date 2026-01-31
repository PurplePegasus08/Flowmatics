import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DataStudio } from './views/DataStudio';
import { Visualization } from './views/Visualization';
import { AiInsights } from './views/AiInsights';
import { Dashboard } from './views/Dashboard';
import { AuthView } from './components/AuthView';
import { SettingsModal } from './components/SettingsModal';
import { AppView, DataRow, ChartConfig, ChatMessage, DashboardItem, User } from './types';
import { CheckCircle2, Info, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import config, { getApiUrl } from './config';

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [data, setData] = useState<DataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, any[]>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' } | null>(null);
  const [sessionId, setSessionId] = useState<string>("default");

  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('insightflow_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'model', content: "Systems synchronized. Intelligence engine initialized. How shall we interrogate the data today?" }
  ]);

  const [vizConfig, setVizConfig] = useState<ChartConfig>({
    id: 'default',
    title: 'Intelligence Report',
    type: 'bar',
    xAxisKey: '',
    yAxisKeys: [],
    theme: 'default',
    aggregation: 'sum',
  });

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('insightflow_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('insightflow_user');
    setCurrentView(AppView.DASHBOARD);
  };

  // Removed custom CSV parser - now using PapaParse

  const handleFileUpload = async (file: File) => {
    // Sync data to backend for REPL/Analysis
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        setNotification({ message: `Upload failed: ${error}`, type: 'info' });
        return;
      }

      const res = await response.json();
      console.log("Backend upload status:", res);

      if (res.sessionId) {
        setSessionId(res.sessionId);
        setNotification({
          message: `Backend Session Initialized: ${res.sessionId.slice(0, 8)}`,
          type: 'success'
        });
      }
    } catch (err) {
      console.error("Backend upload failed:", err);
      setNotification({ message: 'Failed to upload to backend', type: 'info' });
    }

    // Parse CSV with PapaParse (more reliable)
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('CSV parse errors:', results.errors);
          setNotification({ message: 'CSV parsing had some errors', type: 'info' });
        }

        const parsedData = results.data as DataRow[];
        const headers = results.meta.fields || [];

        setHeaders(headers);
        setData(parsedData);
        setCurrentView(AppView.DATA);
        setNotification({
          message: `Database Ingested: ${parsedData.length.toLocaleString()} records.`,
          type: 'success'
        });
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        setNotification({ message: `Failed to parse CSV: ${error.message}`, type: 'info' });
      }
    });
  };

  const handleAddToDashboard = useCallback((config: ChartConfig) => {
    setDashboardItems(prev => [...prev, {
      ...config,
      id: Date.now().toString(),
      x: 40, y: 40, width: 500, height: 400, zIndex: 10
    }]);
    setNotification({ message: 'Insight Pinned to Workbench', type: 'success' });
  }, []);

  const handleRemoveFromDashboard = useCallback((id: string) => {
    setDashboardItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleUpdateDashboardItem = useCallback((id: string, updates: Partial<DashboardItem>) => {
    setDashboardItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const handleAiUpdateViz = useCallback((config: ChartConfig) => {
    setVizConfig({ ...config, theme: 'default', aggregation: 'sum' });
    setCurrentView(AppView.VISUALIZE);
  }, []);

  const handleDataCleanup = useCallback((operation: string, column?: string) => {
    setData(prev => {
      let newData = [...prev];
      const before = newData.length;
      if (operation === 'remove_duplicates') {
        const seen = new Set();
        newData = newData.filter(r => { const s = JSON.stringify(r); if (seen.has(s)) return false; seen.add(s); return true; });
        setNotification({ message: `Optimized Dataset: Removed ${before - newData.length} duplicates.`, type: 'info' });
      }
      return newData;
    });
  }, []);

  const handleRemoveData = useCallback(() => {
    setData([]);
    setHeaders([]);
    setDashboardItems([]);
    setActiveFilters({});
    setSessionId("default");
    setNotification({ message: 'Dataset purged from local intelligence core', type: 'info' });
  }, []);

  if (!user) return <AuthView onLogin={handleLogin} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />;

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <Sidebar
        currentView={currentView} user={user} isOpen={isSidebarOpen} isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)} onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onNavigate={setCurrentView} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-w-0 transition-all relative overflow-hidden">
        {/* Superior Notification System */}
        {notification && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[100] animate-slide-up pointer-events-none">
            <div className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl border backdrop-blur-2xl ${notification.type === 'success' ? 'bg-white/80 dark:bg-slate-900/80 border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
              <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-indigo-500 text-white' : 'bg-slate-500 text-white'}`}>
                {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </div>
              <span className="text-xs font-black uppercase tracking-[0.15em]">{notification.message}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden animate-fade-in">
          {currentView === AppView.DASHBOARD && (
            <Dashboard data={data} isDarkMode={isDarkMode} headers={headers} items={dashboardItems} onUpdateItem={handleUpdateDashboardItem} onRemoveItem={handleRemoveFromDashboard} onNavigateToData={() => setCurrentView(AppView.DATA)} />
          )}
          {currentView === AppView.DATA && (
            <DataStudio data={data} headers={headers} activeFilters={activeFilters} setActiveFilters={setActiveFilters} onFileUpload={handleFileUpload} onCleanData={handleDataCleanup} onRemoveData={handleRemoveData} />
          )}
          {currentView === AppView.VISUALIZE && (
            <Visualization
              data={data}
              isDarkMode={isDarkMode}
              headers={headers}
              config={{ ...vizConfig, columnFilters: activeFilters }}
              setConfig={setVizConfig}
              onAddToDashboard={handleAddToDashboard}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
            />
          )}
          {currentView === AppView.INSIGHTS && (
            <AiInsights
              data={data}
              headers={headers}
              messages={chatMessages}
              setMessages={setChatMessages}
              onUpdateVisualization={handleAiUpdateViz}
              onCleanData={handleDataCleanup}
              onAddToDashboard={handleAddToDashboard}
              sessionId={sessionId}
            />
          )}
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default App;