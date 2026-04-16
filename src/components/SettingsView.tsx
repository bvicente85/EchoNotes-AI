import React, { useState, useEffect } from 'react';
import { X, User, Mic, Monitor, Moon, Sun, Sparkles, Info, Save, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface SettingsViewProps {
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSignOut: () => void;
  initialDisplayName?: string;
  initialTheme?: string;
  initialMode?: string;
  initialLanguage?: string;
  initialSummaryDetail?: string;
  onSettingsUpdate?: (displayName: string, theme: string, mode: string, language: string, summaryDetail: string) => void;
}

export function SettingsView({ 
  onClose, 
  userEmail, 
  userId, 
  onSignOut, 
  onSettingsUpdate,
  initialDisplayName,
  initialTheme,
  initialMode,
  initialLanguage,
  initialSummaryDetail
}: SettingsViewProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName || localStorage.getItem('echonotes_display_name') || '');
  const [defaultMode, setDefaultMode] = useState(initialMode || localStorage.getItem('echonotes_default_mode') || 'mic');
  const [theme, setTheme] = useState(initialTheme || localStorage.getItem('echonotes_theme') || 'light');
  const [language, setLanguage] = useState(initialLanguage || localStorage.getItem('echonotes_language') || 'english');
  const [summaryDetail, setSummaryDetail] = useState(initialSummaryDetail || localStorage.getItem('echonotes_summary_detail') || 'detailed');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    // Save to localStorage (legacy/fallback)
    localStorage.setItem('echonotes_display_name', displayName);
    localStorage.setItem('echonotes_default_mode', defaultMode);
    localStorage.setItem('echonotes_theme', theme);
    localStorage.setItem('echonotes_language', language);
    localStorage.setItem('echonotes_summary_detail', summaryDetail);
    
    // Save to Firestore users collection
    try {
      await setDoc(doc(db, 'users', userId), {
        displayName: displayName,
        defaultMode: defaultMode,
        theme,
        language,
        summaryDetail: summaryDetail,
        updatedAt: serverTimestamp(),
        email: userEmail
      }, { merge: true });
    } catch (err) {
      console.error("Error saving settings to Firestore:", err);
    }

    if (onSettingsUpdate) {
      onSettingsUpdate(displayName, theme, defaultMode, language, summaryDetail);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    
    // Apply theme change
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-app-bg/95 backdrop-blur-md flex items-center justify-center p-6 transition-colors duration-700"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-app-card w-full max-w-2xl rounded-3xl shadow-2xl border border-app-border overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-app-border flex justify-between items-center bg-app-card">
          <div>
            <h2 className="text-3xl font-display font-bold tracking-tight text-app-fg">Settings</h2>
            <p className="text-app-brown/60 text-sm mt-1">Personalize your EchoNotes experience</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-app-bg flex items-center justify-center hover:opacity-80 transition-colors text-app-fg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Profile Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-brown/30">
              <User size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-app-brown/60">Email Address</label>
                <div className="px-4 py-3 bg-app-bg border border-app-border rounded-xl text-sm text-app-brown/40 cursor-not-allowed">
                  {userEmail}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-app-brown/60">Display Name</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-sm focus:ring-2 focus:ring-app-green/10 focus:border-app-green transition-all text-app-fg placeholder:text-app-brown/20"
                />
              </div>
            </div>
          </section>

          {/* Recording Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-brown/30">
              <Mic size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Recording</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-app-brown/60">Default Recording Mode</label>
              <div className="flex bg-app-bg p-1 rounded-xl w-fit border border-app-border">
                <button 
                  onClick={() => setDefaultMode('mic')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                    defaultMode === 'mic' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                  )}
                >
                  <Mic size={14} /> In-Person
                </button>
                <button 
                  onClick={() => setDefaultMode('system')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                    defaultMode === 'system' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                  )}
                >
                  <Monitor size={14} /> Virtual Meeting
                </button>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-brown/30">
              <Sun size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Appearance</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-app-brown/60">Theme</label>
              <div className="flex bg-app-bg p-1 rounded-xl w-fit border border-app-border">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                    theme === 'light' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                  )}
                >
                  <Sun size={14} /> Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                    theme === 'dark' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                  )}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>
          </section>

          {/* AI Preferences */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-brown/30">
              <Sparkles size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">AI Preferences</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-app-brown/60">Output Language</label>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-sm focus:ring-2 focus:ring-app-green/10 focus:border-app-green transition-all text-app-fg"
                >
                  <option value="english">English</option>
                  <option value="portuguese">Português (Europeu)</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="german">German</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-app-brown/60">Summary Detail Level</label>
                <div className="flex bg-app-bg p-1 rounded-xl w-fit border border-app-border">
                  <button 
                    onClick={() => setSummaryDetail('concise')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      summaryDetail === 'concise' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                    )}
                  >
                    Concise
                  </button>
                  <button 
                    onClick={() => setSummaryDetail('detailed')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      summaryDetail === 'detailed' ? "bg-app-card shadow-sm text-app-fg" : "text-app-brown/40 hover:text-app-fg"
                    )}
                  >
                    Detailed
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="pt-6 border-t border-app-border flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-app-dark-green rounded-xl flex items-center justify-center">
                <Sparkles className="text-app-cream" size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-app-fg">EchoNotes v1.2.0</p>
                <p className="text-[10px] text-app-brown/30 uppercase tracking-widest">Powered by Gemini 1.5 Flash</p>
              </div>
            </div>
            <button 
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors text-xs font-bold"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-app-bg border-t border-app-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-app-brown/60 hover:text-app-fg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 px-8 py-2 rounded-xl text-sm font-bold transition-all",
              isSaved 
                ? "bg-app-green text-white" 
                : "bg-app-dark-green text-app-cream hover:opacity-90"
            )}
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? 'Settings Saved' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
