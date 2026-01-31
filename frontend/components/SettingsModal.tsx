
import React, { useState } from 'react';
import { X, User, Bell, Shield, Database, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onClose: () => void;
}

type TabType = 'profile' | 'notifications' | 'api' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, isDarkMode, onToggleDarkMode, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  if (!isOpen) return null;

  const NavButton = ({ tab, label, icon: Icon }: { tab: TabType, label: string, icon: any }) => (
    <button 
        onClick={() => setActiveTab(tab)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === tab 
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
    >
        <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-colors duration-300">
        
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-100 dark:border-gray-700 p-4 space-y-2 transition-colors">
                <NavButton tab="profile" label="Profile" icon={User} />
                <NavButton tab="notifications" label="Notifications" icon={Bell} />
                <NavButton tab="api" label="API Keys" icon={Shield} />
                <NavButton tab="data" label="Data Management" icon={Database} />
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-800 transition-colors">
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">User Profile</h3>
                            <p className="text-sm text-gray-500 mb-4">Manage your personal information and preferences.</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Display Name</label>
                                    <input type="text" defaultValue="Analyst" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Email</label>
                                    <input type="email" defaultValue="user@insightflow.ai" disabled className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed opacity-60" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">App Preferences</h3>
                            <div className="mt-4 space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                      type="checkbox" 
                                      checked={isDarkMode} 
                                      onChange={onToggleDarkMode}
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-blue-600 focus:ring-blue-600" 
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors font-medium">Dark Mode Enabled</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-blue-600 focus:ring-blue-600" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors font-medium">Auto-save Dashboard Layout</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Notification Settings</h3>
                        <p className="text-sm text-gray-500">Choose what you want to be notified about.</p>
                        
                        <div className="space-y-4">
                            {['Data import completion', 'AI Analysis ready', 'Export finished'].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item}</span>
                                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-blue-600" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                     <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">API Configuration</h3>
                        <p className="text-sm text-gray-500">Manage your connection to Gemini AI.</p>
                        
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Secure Environment</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">Your API key is processed securely via environment variables and never exposed to the frontend directly.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                 {activeTab === 'data' && (
                     <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Data Management</h3>
                        <p className="text-sm text-gray-500">Control your local data storage.</p>
                        
                        <div className="space-y-4">
                             <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Clear Local Cache</p>
                                    <p className="text-xs text-gray-500 mt-1">Removes temporary visualization states</p>
                                </div>
                                <button className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors">Clear</button>
                             </div>
                             <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 transition-colors shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Reset Application</p>
                                    <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-1">Clear all data and settings</p>
                                </div>
                                <button className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold text-white shadow-md transition-all active:scale-95">Reset</button>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 transition-colors">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-sm font-semibold transition-colors">Cancel</button>
            <button onClick={onClose} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md transition-all active:scale-95">
                <Check className="w-4 h-4" /> Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};