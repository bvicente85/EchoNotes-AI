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
  const [customTerms, setCustomTerms] = useState(localStorage.getItem('echonotes_custom_terms') || '');
  const [aiModel, setAiModel] = useState(localStorage.getItem('echonotes_ai_model') || 'gemini-3.5-flash');
  const [meetingTone, setMeetingTone] = useState(localStorage.getItem('echonotes_meeting_tone') || 'professional');
  const [customGuidelines, setCustomGuidelines] = useState(localStorage.getItem('echonotes_custom_guidelines') || '');
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
    // Defer reading the storage size from local IndexedDB to allow transition animations to run completely lag-free
    const timer = setTimeout(() => {
      loadStorageSize();
    }, 650);
    return () => clearTimeout(timer);
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
    localStorage.setItem('echonotes_custom_terms', customTerms);
    localStorage.setItem('echonotes_ai_model', aiModel);
    localStorage.setItem('echonotes_meeting_tone', meetingTone);
    localStorage.setItem('echonotes_custom_guidelines', customGuidelines);
    
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
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md flex items-center justify-center p-6"
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
            className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-app-accent/10 hover:text-app-accent transition-colors text-app-fg"
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
                    defaultMode === 'mic' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Mic size={14} /> {t('inPerson')}
                </button>
                <button 
                  onClick={() => setDefaultMode('system')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    defaultMode === 'system' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
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
                    theme === 'light' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
                  )}
                >
                  <Sun size={14} /> {t('light')}
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    theme === 'dark' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
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
                      summaryDetail === 'concise' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
                    )}
                  >
                    {t('concise')}
                  </button>
                  <button 
                    onClick={() => setSummaryDetail('detailed')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      summaryDetail === 'detailed' ? "bg-app-accent text-white dark:bg-app-accent dark:text-[#131924] shadow-xs font-bold" : "text-app-fg/50 hover:text-app-fg"
                    )}
                  >
                    {t('detailed')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Model de IA de Precisão</label>
                <select 
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg appearance-none cursor-pointer"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Rápido & Inteligente)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Alta Precisão & Raciocínio)</option>
                </select>
                <p className="text-[10px] text-app-fg/40">O Pro é excelente para reuniões densas e com terminologia complexa.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Tom do Relatório</label>
                <select 
                  value={meetingTone}
                  onChange={(e) => setMeetingTone(e.target.value)}
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg appearance-none cursor-pointer"
                >
                  <option value="professional">Profissional & Formal</option>
                  <option value="technical">Técnico & Preciso</option>
                  <option value="casual">Conversacional & Descontraído</option>
                  <option value="action_oriented">Focado em Ações & Resultados</option>
                </select>
                <p className="text-[10px] text-app-fg/40">Modifica o vocabulário e a estrutura da análise gerada pela IA.</p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Dicionário Pessoal (Termos Customizados)</label>
                <input 
                  type="text"
                  value={customTerms}
                  onChange={(e) => setCustomTerms(e.target.value)}
                  placeholder="Ex: Skolae, EchoNotes, Projeto X, Ana Silva"
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg placeholder:text-app-fg/20"
                />
                <p className="text-[10px] text-app-fg/40">Termos, marcas ou nomes separados por vírgula que a IA deve reconhecer sem autocorrigir.</p>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-app-fg/40">Instruções Customizadas da IA (Diretrizes Adicionais)</label>
                <textarea 
                  value={customGuidelines}
                  onChange={(e) => setCustomGuidelines(e.target.value)}
                  placeholder="Ex: Sempre colocar números de faturação em tabelas. Ignorar os primeiros 5 minutos de conversas informais. Formatar as ações futuras com data limite explícita."
                  rows={3}
                  className="w-full px-5 py-4 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg placeholder:text-app-fg/20 resize-none"
                />
                <p className="text-[10px] text-app-fg/40">Instruções ou regras específicas que o modelo de IA seguirá estritamente para compilar o resumo e as notas.</p>
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
                  <span className="text-xs font-mono font-bold text-app-green">
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
                    ? "text-app-green bg-app-green/10 border-app-green/20"
                    : "text-app-accent hover:bg-app-accent/10 border-app-accent/10"
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
              <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 text-app-accent rounded-2xl flex items-center justify-center border border-slate-200/50 dark:border-white/5 shadow-sm shrink-0">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-app-fg uppercase tracking-tight">EchoNotes v1.2.0</p>
                <p className="text-[10px] text-app-fg/40 uppercase tracking-[0.2em] font-black mt-1">Powered by Gemini AI</p>
              </div>
            </div>
            <button 
              onClick={onSignOut}
              className="flex items-center gap-2 px-5 py-2.5 text-app-accent hover:bg-app-accent/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest glass"
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
                ? "bg-app-green text-white" 
                : "bg-app-accent hover:opacity-90 dark:bg-app-accent dark:text-[#131924] text-white font-bold hover:scale-[1.02] active:scale-98"
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
