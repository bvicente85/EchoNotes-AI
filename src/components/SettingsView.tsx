import React, { useState, useEffect } from 'react';
import { X, User, Mic, Monitor, Moon, Sun, Sparkles, Info, Save, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

import { getSupabase } from '../supabase';

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
    
    // Save to Supabase profiles table
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: displayName,
          default_mode: defaultMode,
          theme: theme,
          language: language,
          summary_detail: summaryDetail,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error("Error saving settings to Supabase:", err);
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
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md flex items-center justify-center p-6 transition-colors duration-700"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-app-border flex justify-between items-center glass">
          <div>
            <h2 className="text-3xl font-display font-black tracking-tight text-app-fg">Settings</h2>
            <p className="text-app-fg/40 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Personalize EchoNotes</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-colors text-app-fg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Profile Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <User size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Profile</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Email Address</label>
                <div className="px-5 py-4 glass rounded-2xl text-sm text-app-fg/30 cursor-not-allowed">
                  {userEmail}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Display Name</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg placeholder:text-app-fg/20"
                />
              </div>
            </div>
          </section>

          {/* Recording Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <Mic size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Recording</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-app-fg/40">Default Recording Mode</label>
              <div className="flex glass p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setDefaultMode('mic')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    defaultMode === 'mic' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                  )}
                >
                  <Mic size={14} /> In-Person
                </button>
                <button 
                  onClick={() => setDefaultMode('system')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    defaultMode === 'system' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                  )}
                >
                  <Monitor size={14} /> Virtual Meeting
                </button>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <Sun size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Appearance</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-app-fg/40">Theme</label>
              <div className="flex glass p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    theme === 'light' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                  )}
                >
                  <Sun size={14} /> Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    theme === 'dark' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                  )}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>
          </section>

          {/* AI Preferences */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <Sparkles size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">AI Preferences</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Output Language</label>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg appearance-none cursor-pointer"
                >
                  <option value="english">English</option>
                  <option value="portuguese">Português (Europeu)</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="german">German</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Summary Detail Level</label>
                <div className="flex glass p-1.5 rounded-2xl w-fit">
                  <button 
                    onClick={() => setSummaryDetail('concise')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      summaryDetail === 'concise' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                    )}
                  >
                    Concise
                  </button>
                  <button 
                    onClick={() => setSummaryDetail('detailed')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      summaryDetail === 'detailed' ? "bg-app-accent text-app-light-gold shadow-lg" : "text-app-fg/40 hover:text-app-fg"
                    )}
                  >
                    Detailed
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="pt-8 border-t border-app-border flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-app-accent text-app-light-gold rounded-2xl flex items-center justify-center shadow-lg shadow-app-accent/20">
                <Sparkles size={24} />
              </div>
              <div>
                <p className="text-sm font-black text-app-fg uppercase tracking-tight">EchoNotes v1.2.0</p>
                <p className="text-[10px] text-app-fg/40 uppercase tracking-[0.2em] font-black mt-1">Powered by Gemini AI</p>
              </div>
            </div>
            <button 
              onClick={onSignOut}
              className="flex items-center gap-2 px-5 py-2.5 text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest glass"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-8 glass flex justify-end items-center gap-6">
          <button 
            onClick={onClose}
            className="text-xs font-black uppercase tracking-[0.2em] text-app-fg/40 hover:text-app-fg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className={cn(
              "flex items-center gap-3 px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl",
              isSaved 
                ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                : "bg-app-accent text-app-light-gold shadow-app-accent/30 hover:scale-105 active:scale-95"
            )}
          >
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            {isSaved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
