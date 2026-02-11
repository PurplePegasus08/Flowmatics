import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Database, BarChart2, BrainCircuit, Settings, ChevronLeft, ChevronRight, Moon, Sun, LogOut, History, MessageSquare, Pen, Trash2 } from 'lucide-react';
import { AppView, User } from '../types';
import { getApiUrl } from '../config';

interface SidebarProps {
  currentView: AppView;
  user: User;
  isOpen: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onToggle: () => void;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onLoadSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  user,
  isOpen,
  isDarkMode,
  onToggleTheme,
  onToggle,
  onNavigate,
  onOpenSettings,
  onLogout,
  onLoadSession,
  onRenameSession,
  onDeleteSession
}) => {
  const [sessions, setSessions] = useState<{ id: string, title: string, timestamp: number }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(getApiUrl('/api/sessions'));
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  const navItems = [
    { id: AppView.DASHBOARD, label: 'Workbench', icon: LayoutDashboard },
    { id: AppView.DATA, label: 'Data Hub', icon: Database },
    { id: AppView.VISUALIZE, label: 'Studio', icon: BarChart2 },
    { id: AppView.INSIGHTS, label: 'Copilot', icon: BrainCircuit },
  ];

  return (
    <aside
      className={`${isOpen ? 'w-64' : 'w-20'} bg-white dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 flex flex-col h-full shrink-0 z-50 transition-all duration-300 ease-in-out relative`}
    >
      {/* Brand Header */}
      <div className={`h-20 px-6 flex items-center gap-3 ${!isOpen && 'justify-center px-0'}`}>
        <img
          src="/logo.png"
          alt="Logo"
          className="w-10 h-10 rounded-xl object-cover shadow-soft"
        />
        {isOpen && (
          <div className="flex flex-col">
            <h1 className="font-bold text-base text-surface-900 dark:text-white leading-tight">
              InsightFlow
            </h1>
            <span className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-widest">Analytics Core</span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${currentView === item.id
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700/50 hover:text-surface-900 dark:hover:text-surface-200'
              } ${!isOpen && 'justify-center'}`}
          >
            <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300'}`} />
            {isOpen && <span className="text-[13px] tracking-tight">{item.label}</span>}
            {!isOpen && currentView === item.id && (
              <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-indigo-600 rounded-r-full shadow-[2px_0_10px_rgba(79,70,229,0.5)]"></div>
            )}
          </button>
        ))}

        {/* History Section - Only visible in Copilot/Insights view */}
        {isOpen && currentView === AppView.INSIGHTS && sessions.length > 0 && (
          <div className="pt-6 pb-2">
            <div className="px-3 mb-2 flex items-center gap-2 text-xs font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
              <History className="w-3 h-3" />
              <span>Recent Sessions</span>
            </div>
            <div className="space-y-1">
              {sessions.slice(0, 5).map(session => (
                <div key={session.id} className="group relative">
                  <button
                    onClick={() => onLoadSession(session.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors pr-8"
                  >
                    <MessageSquare className="w-4 h-4 text-surface-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {editingId === session.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              await onRenameSession(session.id, editTitle);
                              setEditingId(null);
                              fetchSessions(); // Refresh list after rename
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => setEditingId(null)}
                          className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-600 rounded px-1 py-0.5 text-xs text-surface-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-sm text-surface-600 dark:text-surface-300 truncate">{session.title || "Untitled Session"}</p>
                      )}
                      <p className="text-[10px] text-surface-400">{new Date(session.timestamp * 1000).toLocaleDateString()}</p>
                    </div>
                  </button>

                  {/* Action Buttons - Only visible in Copilot view and on hover */}
                  {currentView === AppView.INSIGHTS && !editingId && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setEditingId(session.id);
                          setEditTitle(session.title || "Untitled Session");
                          // Note: Rename is triggered on Enter/Save, not here. 
                          // But we need to update the save handler below inside the input.
                        }}
                        className="p-1 text-surface-400 hover:text-indigo-600 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                        title="Rename"
                      >
                        <Pen className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteSession(session.id);
                          fetchSessions(); // Refresh list after delete
                        }}
                        className="p-1 text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Utilities */}
      <div className="px-3 py-6 border-t border-surface-100 dark:border-surface-700 space-y-1.5">
        <button
          onClick={onToggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors ${!isOpen && 'justify-center'}`}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {isOpen && <span className="text-xs font-medium">Appearance</span>}
        </button>

        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors ${!isOpen && 'justify-center'}`}
        >
          <Settings className="w-5 h-5" />
          {isOpen && <span className="text-xs font-medium">Preferences</span>}
        </button>
      </div>

      {/* User Branding */}
      <div className={`p-4 border-t border-surface-100 dark:border-surface-700 ${!isOpen && 'flex justify-center'}`}>
        <div className={`flex items-center gap-3 ${isOpen ? 'bg-surface-50 dark:bg-surface-900/40' : ''} p-2 rounded-2xl transition-colors`}>
          <div className="w-9 h-9 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-300 font-bold text-xs shrink-0 border border-white dark:border-surface-600">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <p className="text-[13px] font-bold text-surface-900 dark:text-white truncate leading-none mb-1">{user.name}</p>
              <button
                onClick={onLogout}
                className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 hover:text-red-500 flex items-center gap-1 transition-colors text-left uppercase tracking-wider"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button - Repositioned for cleaner UI */}
      <button
        onClick={onToggle}
        className="absolute -right-3 bottom-24 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-surface-400 hover:text-indigo-600 rounded-full p-1.5 shadow-sm z-50 transition-all hover:scale-110 active:scale-95"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  );
};