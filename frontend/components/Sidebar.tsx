import React from 'react';
import { LayoutDashboard, Database, BarChart2, BrainCircuit, Settings, ChevronLeft, ChevronRight, Moon, Sun, LogOut, Command } from 'lucide-react';
import { AppView, User } from '../types';

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
  onLogout
}) => {
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
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-soft">
          <Command className="text-white w-6 h-6" />
        </div>
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
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
              currentView === item.id
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