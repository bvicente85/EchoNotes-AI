import React, { useState, useEffect } from 'react';
import { X, User, Mic, Monitor, Moon, Sun, Sparkles, Info, Save, Check, LogOut, HardDrive, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { getSupabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { getAudioStorageSize, clearAllAudios } from '../services/audioStorage';

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
  const { setLanguage: setGlobalLanguage, t } = useLanguage();
  const [displayName, setDisplayName] = useState(initialDisplayName || localStorage.getItem('echonotes_display_name') || '');
  const [defaultMode, setDefaultMode] = useState(initialMode || localStorage.getItem('echonotes_default_mode') || 'mic');
  const [theme, setTheme] = useState(initialTheme || localStorage.getItem('echonotes_theme') || 'light');
  const [language, setLanguage] = useState(initialLanguage || localStorage.getItem('echonotes_language') || 'english');
  const [summaryDetail, setSummaryDetail] = useState(initialSummaryDetail || localStorage.getItem('echonotes_summary_detail') || 'detailed');
  const [isSaved, setIsSaved] = useState(false);

  // Raw local storage tracking state for audio records
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [isClearingStorage, setIsClearingStorage] = useState(false);
  const [storageClearedSuccess, setStorageClearedSuccess] = useState(false);

  const loadStorageSize = async () => {
    try {
      const size = await getAudioStorageSize();
      setStorageBytes(size);
    } catch (err) {
      console.error("Failed to load local audio storage size:", err);
    }
  };

  useEffect(() => {
    loadStorageSize();
  }, []);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0.0 MB'; // Make it clean and default
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // If it's bytes or KB, format as MB anyway so it's intuitive, or let sizes do the job
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleClearLocalAudios = async () => {
    setIsClearingStorage(true);
    try {
      await clearAllAudios();
      await loadStorageSize();
      setStorageClearedSuccess(true);
      setTimeout(() => setStorageClearedSuccess(false), 3000);
    } catch (err) {
      console.error("Error clearing local audios:", err);
    } finally {
      setIsClearingStorage(false);
    }
  };

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

    // Call the context to update language database-wide & browser-wide
    await setGlobalLanguage(language);

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
            <h2 className="text-3xl font-display font-black tracking-tight text-app-fg">{t('settings')}</h2>
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
              <span className="text-[10px] font-black uppercase tracking-widest">{t('profile')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">{t('emailAddress')}</label>
                <div className="px-5 py-4 glass rounded-2xl text-sm text-app-fg/30 cursor-not-allowed">
                  {userEmail}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">{t('yourName')}</label>
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
              <span className="text-[10px] font-black uppercase tracking-widest">{t('recording')}</span>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold text-app-fg/45">{t('defaultRecordingMode')}</label>
              <div className="flex glass p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setDefaultMode('mic')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    defaultMode === 'mic' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Mic size={14} /> {t('inPerson')}
                </button>
                <button 
                  onClick={() => setDefaultMode('system')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    defaultMode === 'system' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Monitor size={14} /> {t('virtualMeeting')}
                </button>
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <Sun size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('appearance')}</span>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold text-app-fg/45">{t('theme')}</label>
              <div className="flex glass p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    theme === 'light' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Sun size={14} /> {t('light')}
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    theme === 'dark' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Moon size={14} /> {t('dark')}
                </button>
              </div>
            </div>
          </section>

          {/* AI Preferences */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <Sparkles size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('aiPreferences')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">{t('outputLanguage')}</label>
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
                 <label className="text-xs font-bold text-app-fg/45">{t('summaryDetailLevel')}</label>
                <div className="flex glass p-1.5 rounded-2xl w-fit">
                  <button 
                    onClick={() => setSummaryDetail('concise')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      summaryDetail === 'concise' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                    )}
                  >
                    {t('concise')}
                  </button>
                  <button 
                    onClick={() => setSummaryDetail('detailed')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      summaryDetail === 'detailed' ? "bg-[#526C78] text-white dark:bg-[#6CA0BB] dark:text-[#0F172A] shadow-md font-bold" : "text-app-fg/50 hover:text-app-fg"
                    )}
                  >
                    {t('detailed')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Manage Storage section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-app-accent">
              <HardDrive size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('manageStorage')}</span>
            </div>
            <div className="p-6 bg-slate-500/5 dark:bg-slate-400/5 border border-slate-500/10 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-app-fg/70">
                  {t('manageStorageDesc')}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-app-fg/40">
                    {t('storageUsed')}:
                  </span>
                  <span className="text-xs font-mono font-bold text-[#1eac82]">
                    {storageBytes !== null ? formatBytes(storageBytes) : '...'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearLocalAudios}
                disabled={isClearingStorage || storageBytes === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all glass shrink-0 cursor-pointer",
                  storageBytes === 0
                    ? "opacity-50 cursor-not-allowed text-app-fg/30"
                    : storageClearedSuccess
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-500 hover:bg-rose-500/10 border-rose-500/10"
                )}
              >
                {storageClearedSuccess ? (
                  <>
                    <Check size={14} />
                    {t('clearStorageDone')}
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    {t('clearStorage')}
                  </>
                )}
              </button>
            </div>
          </section>

          {/* About Section */}
          <section className="pt-8 border-t border-app-border flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 text-[#526C78] dark:text-[#6CA0BB] rounded-2xl flex items-center justify-center border border-slate-200/50 dark:border-white/5 shadow-sm shrink-0">
                <Sparkles size={22} />
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
              <LogOut size={16} /> {t('signOut')}
            </button>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-8 glass flex justify-end items-center gap-6">
          <button 
            onClick={onClose}
            className="text-xs font-black uppercase tracking-[0.2em] text-app-fg/40 hover:text-app-fg transition-colors"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave}
            className={cn(
              "flex items-center gap-3 px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-md",
              isSaved 
                ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                : "bg-[#526C78] hover:bg-[#435761] dark:bg-[#6CA0BB] dark:hover:bg-[#5b8fa8] text-white dark:text-slate-950 font-bold hover:scale-[1.02] active:scale-98"
            )}
          >
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            {isSaved ? t('saved') : t('saveChanges')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
