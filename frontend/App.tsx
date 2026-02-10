import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DataStudio } from './views/DataStudio';
import { Visualization } from './views/Visualization';
import { AiInsights } from './views/AiInsights';
import { Dashboard } from './views/Dashboard';
import { AuthView } from './components/AuthView';
import { SettingsModal } from './components/SettingsModal';
import { AppView, DataRow, ChartConfig, ChatMessage, DashboardItem, User } from './types';

import config, { getApiUrl } from './config';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [data, setData] = useState<DataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, any[]>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string>("default");

  const { notify } = useNotification();

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

  const handleLoadSession = async (sid: string) => {
    try {
      notify("Restoring session...", "info");

      // 1. Get Session Details (History)
      const sessionRes = await fetch(getApiUrl(`/api/session/${sid}`));
      if (!sessionRes.ok) throw new Error("Failed to load session details");
      const sessionData = await sessionRes.json();

      // 2. Get Data Preview
      const dataRes = await fetch(getApiUrl(`/api/preview/${sid}?limit=1000`));
      if (!dataRes.ok) throw new Error("Failed to load dataset");
      const dataContent = await dataRes.json();

      // Update State
      setSessionId(sid);

      if (sessionData.history && sessionData.history.length > 0) {
        // Map backend history to frontend format if needed, or assume compatible
        // Backend stores raw Gemini history. Frontend uses { id, role, content }
        // We'll trust the mapping or adjust if strictly typed.
        // Assuming backend sends compatible list or we map it.
        // Backend: { role: 'user'|'model', parts: [{text: ''}] }
        // Frontend: { id, role, content }
        const mappedMessages = sessionData.history.map((msg: any, idx: number) => ({
          id: idx.toString(),
          role: msg.role === 'user' ? 'user' : 'model',
          content: msg.parts?.[0]?.text || ""
        }));
        setChatMessages(mappedMessages);
      } else {
        setChatMessages([{ id: '0', role: 'model', content: "Session restored. Ready for analysis." }]);
      }

      if (dataContent.rows && dataContent.rows.length > 0) {
        setData(dataContent.rows);
        setHeaders(Object.keys(dataContent.rows[0]));
        setCurrentView(AppView.INSIGHTS); // Go to insights to see history
      } else {
        notify("Session loaded but no data found.", "info");
      }

      notify("Session restored successfully", "success");

    } catch (e) {
      console.error("Load session failed:", e);
      notify("Failed to load session", "error");
    }
  };

  const handleFileUpload = async (file: File) => {
    // Sync data to backend
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(getApiUrl('/api/upload'), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        notify(`Upload failed: ${error}`, 'info');
        return;
      }

      const res = await response.json();
      console.log("Backend upload status:", res);

      if (res.sessionId) {
        setSessionId(res.sessionId);

        if (res.preview && res.preview.length > 0) {
          setData(res.preview);
          setHeaders(Object.keys(res.preview[0]));
          setCurrentView(AppView.DATA);
          notify(`Dataset Uploaded: ${res.totalRows?.toLocaleString() || 'Many'} records.`, 'success');
        } else {
          notify('Upload successful but no data preview returned', 'info');
        }
      }
    } catch (err) {
      console.error("Backend upload failed:", err);
      notify('Failed to upload to backend', 'info');
    }


  };

  const handleAddToDashboard = useCallback((config: ChartConfig) => {
    setDashboardItems(prev => [...prev, {
      ...config,
      id: Date.now().toString(),
      x: 40, y: 40, width: 500, height: 400, zIndex: 10
    }]);
    notify('Insight Pinned to Workbench', 'success');
  }, [notify]);

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
        notify(`Optimized Dataset: Removed ${before - newData.length} duplicates.`, 'info');
      }
      return newData;
    });
  }, [notify]);

  const handleRemoveData = useCallback(() => {
    setData([]);
    setHeaders([]);
    setDashboardItems([]);
    setActiveFilters({});
    setSessionId("default");
    notify('Dataset purged from local intelligence core', 'info');
  }, [notify]);

  if (!user) return <AuthView onLogin={handleLogin} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)} />;

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <Sidebar
        currentView={currentView} user={user} isOpen={isSidebarOpen} isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)} onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onNavigate={setCurrentView} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={handleLogout}
        onLoadSession={handleLoadSession}
      />

      <main className="flex-1 flex flex-col min-w-0 transition-all relative overflow-hidden">
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

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;