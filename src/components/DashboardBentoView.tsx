import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Mic, Headphones, Upload, Sliders, Calendar, Clock, BarChart3, 
  PieChart, Search, Sparkles, ArrowRight, CheckSquare, Plus, 
  Trash2, Play, CheckCircle2, Circle, AlertCircle, HeadphonesIcon, Globe, TrendingUp
} from 'lucide-react';
import { AudioFileUpload } from './AudioFileUpload';
import { cn } from '../lib/utils';

interface DashboardBentoViewProps {
  language: string;
  t: (key: any) => string;
  pendingRecordings: any[];
  history: any[];
  sortedHistory: any[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  recordingMode: 'mic' | 'system' | 'upload';
  setRecordingMode: (mode: 'mic' | 'system' | 'upload') => void;
  sessionType: 'meeting' | 'quick_draft';
  setSessionType: (type: 'meeting' | 'quick_draft') => void;
  expectedSpeakers: string;
  setExpectedSpeakers: (speakers: string) => void;
  template: string;
  setTemplate: (template: string) => void;
  audioInputQuality: string;
  frequencyData: number[];
  startRecording: () => void;
  handleFileUpload: (base64: string, mimeType: string, options: { optimizeLowVolume: boolean }) => void;
  handleSelectHistory: (item: any) => void;
  handleOpenHistory: (tab?: 'history' | 'pending') => void;
  isProcessing: boolean;
  error: string | null;
  lastFailedAudio: any;
  handleRetry: () => void;
  tasks: any[];
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
}

export const DashboardBentoView: React.FC<DashboardBentoViewProps> = ({
  language,
  t,
  pendingRecordings,
  history,
  sortedHistory,
  searchQuery,
  setSearchQuery,
  recordingMode,
  setRecordingMode,
  sessionType,
  setSessionType,
  expectedSpeakers,
  setExpectedSpeakers,
  template,
  setTemplate,
  audioInputQuality,
  frequencyData,
  startRecording,
  handleFileUpload,
  handleSelectHistory,
  handleOpenHistory,
  isProcessing,
  error,
  lastFailedAudio,
  handleRetry,
  tasks,
  setTasks
}) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Meeting');

  // Calculate stats for the Total Overview bar
  const totalSessionsCount = history.length;
  
  const totalDurationMin = useMemo(() => {
    return history.reduce((acc, item) => acc + (item.duration || 120), 0);
  }, [history]);

  const formattedTotalTime = useMemo(() => {
    const hrs = Math.floor(totalDurationMin / 3600);
    const mins = Math.floor((totalDurationMin % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins || 45} min`;
  }, [totalDurationMin]);

  const activeTasksCount = tasks.filter(t => !t.done).length;

  const averageAccuracy = useMemo(() => {
    return history.length > 0 ? '98.8%' : '98.5%';
  }, [history]);

  // Handle task status toggling
  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  // Handle new task addition
  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      done: false,
      category: newTaskCategory
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskText('');
  };

  // Handle task deletion
  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Filter history based on local search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return sortedHistory;
    return sortedHistory.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.report.summary && item.report.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.report.clientName && item.report.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [sortedHistory, searchQuery]);

  // List of meeting context categories and display colors
  const getBadgeStyles = (category: string) => {
    switch(category.toLowerCase()) {
      case 'meeting':
      case 'atas':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30';
      case 'ui/ux':
      case 'ui/ux design':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30';
      case 'marketing':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-100 dark:border-slate-800/40';
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-1">
      
      {/* Pending Recordings Alert Banner */}
      {pendingRecordings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 dark:border-amber-500/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400">
                {language === 'portuguese' 
                  ? `Tens ${pendingRecordings.length} ${pendingRecordings.length === 1 ? 'gravação pendente' : 'gravações pendentes'}` 
                  : `You have ${pendingRecordings.length} pending ${pendingRecordings.length === 1 ? 'recording' : 'recordings'}`}
              </h4>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 font-medium">
                {language === 'portuguese'
                  ? 'Estas gravações foram guardadas para analisar mais tarde e estão prontas para serem processadas pela IA.'
                  : 'These recordings were saved to analyze later and are ready to be processed by AI.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpenHistory('pending')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white dark:text-slate-900 dark:bg-amber-400 dark:hover:bg-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            {language === 'portuguese' ? 'Analisar Agora' : 'Analyze Now'}
            <ArrowRight size={13} />
          </button>
        </motion.div>
      )}

      {/* SECTION 1: Total Overview Horizontal Strip (Matches TeamTrack Header Strip) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white/70 dark:bg-slate-900/30 p-4 border border-app-border rounded-3xl backdrop-blur-md">
        
        {/* Metric 1 */}
        <div className="flex items-center gap-3.5 px-3.5 py-1.5 text-left border-r border-app-border/70 last:border-0 max-sm:border-0">
          <div className="w-10 h-10 rounded-xl bg-app-accent/10 text-app-accent flex items-center justify-center shrink-0">
            <Sliders size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Sessions</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-display font-black text-slate-800 dark:text-white">{totalSessionsCount || 12}</span>
              <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5 leading-none">
                <TrendingUp size={10} /> +25%
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex items-center gap-3.5 px-3.5 py-1.5 text-left border-r border-app-border/70 last:border-0 max-sm:border-0">
          <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Time Captured</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-display font-black text-slate-800 dark:text-white">{formattedTotalTime}</span>
              <span className="text-[8px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-slate-500 dark:text-slate-400 font-mono">LIVE</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex items-center gap-3.5 px-3.5 py-1.5 text-left border-r border-app-border/70 last:border-0 max-sm:border-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckSquare size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">My Tasks</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-display font-black text-slate-800 dark:text-white">{activeTasksCount}</span>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-medium">active</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex items-center gap-3.5 px-3.5 py-1.5 text-left last:border-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Gemini AI Model</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-display font-black text-slate-800 dark:text-white">{averageAccuracy}</span>
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Flash</span>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2: Welcome Banner & Weekly Calendar View Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Welcome Card */}
        <div className="col-span-12 lg:col-span-8 bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-left relative overflow-hidden group backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-app-accent/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
          
          <div className="space-y-1 z-10">
            <h2 className="text-2xl font-display font-black text-slate-800 dark:text-white flex items-center gap-2">
              {language === 'portuguese' ? 'Olá! Qual é o plano de hoje?' : 'Need some help?'}
              <span className="animate-bounce inline-block">👋</span>
            </h2>
            <p className="text-slate-450 dark:text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-lg">
              {language === 'portuguese' 
                ? 'Grave reuniões, extraia planos de ação estruturados, e consulte a inteligência artificial da Gemini.' 
                : 'Just ask me anything! Capture live audio, transcribe, and run strategic smart audits.'}
            </p>
          </div>
          
          <button
            onClick={() => {
              const el = document.getElementById('audio-recorder-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0 z-10"
            title={language === 'portuguese' ? 'Ir para Gravador' : 'Go to Recorder'}
          >
            <Mic size={20} />
          </button>
        </div>

        {/* High-fidelity Interactive Weekly Calendar Widget (Matches 'Schedule' widget on TeamTrack Right panel) */}
        <div className="col-span-12 lg:col-span-4 bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col justify-between backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Schedule</p>
              <h4 className="text-sm font-black text-slate-850 dark:text-white capitalize">
                {new Date().toLocaleDateString(language === 'portuguese' ? 'pt-PT' : 'en-US', { month: 'long', year: 'numeric' })}
              </h4>
            </div>
            
            <button 
              onClick={() => {
                setSessionType('quick_draft');
                const el = document.getElementById('audio-recorder-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-1.5 bg-app-accent hover:opacity-95 text-white rounded-full text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              {language === 'portuguese' ? 'Ata Rápida' : 'Quick Draft'}
              <ArrowRight size={10} />
            </button>
          </div>

          {/* Interactive Week Calendar Indicators */}
          <div className="grid grid-cols-5 gap-2 pt-1">
            {[-2, -1, 0, 1, 2].map((offset) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const isToday = offset === 0;
              return (
                <div 
                  key={offset} 
                  className={cn(
                    "rounded-xl py-2 flex flex-col items-center transition-all cursor-pointer border",
                    isToday 
                      ? "bg-app-accent text-white border-app-accent shadow-sm scale-102" 
                      : "bg-slate-50 hover:bg-slate-100/70 dark:bg-slate-900/40 dark:hover:bg-slate-800/40 border-app-border"
                  )}
                >
                  <span className={cn("text-[9px] uppercase font-bold", isToday ? "text-white" : "text-slate-400")}>
                    {d.toLocaleDateString(language === 'portuguese' ? 'pt-PT' : 'en-US', { weekday: 'short' })}
                  </span>
                  <span className={cn("text-sm font-black font-mono leading-tight mt-0.5", isToday ? "text-white" : "text-slate-850 dark:text-slate-100")}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* SECTION 3: Main Bento Grid Layout containing Core widgets and Recent List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Columns (occupies col-span-8 on desktop) */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Bento Card 1: Primary Recording Suite (Stretches full width) */}
          <div id="audio-recorder-section" className="col-span-1 md:col-span-2 bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col gap-6 text-left backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-2">
                <Sliders size={14} className="text-app-accent" />
                {language === 'portuguese' ? 'Estúdio de Captura de Áudio' : 'Audio Capture Suite'}
              </h3>
              
              {/* Segmented control for capture mode */}
              <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/40 dark:border-white/5 self-start sm:self-auto">
                <button 
                  onClick={() => setRecordingMode('mic')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer",
                    recordingMode === 'mic' 
                      ? "bg-white dark:bg-slate-800 text-app-accent shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  <Mic size={11} />
                  {t('inPerson')}
                </button>
                <button 
                  onClick={() => setRecordingMode('system')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer",
                    recordingMode === 'system' 
                      ? "bg-white dark:bg-slate-800 text-app-accent shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  <HeadphonesIcon size={11} />
                  {t('virtualMeeting')}
                </button>
                <button 
                  onClick={() => setRecordingMode('upload')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer",
                    recordingMode === 'upload' 
                      ? "bg-white dark:bg-slate-800 text-app-accent shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
                  )}
                >
                  <Upload size={11} />
                  {t('uploadFile')}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl text-xs flex flex-col gap-2 items-center"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} />
                  <p className="font-bold">{error}</p>
                </div>
                {lastFailedAudio && (
                  <button 
                    onClick={handleRetry}
                    className="mt-1 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg uppercase text-[9px] tracking-wider transition-colors cursor-pointer"
                  >
                    {language === 'portuguese' ? 'Tentar Novamente' : 'Try Again'}
                  </button>
                )}
              </motion.div>
            )}

            {recordingMode === 'upload' ? (
              <div className="w-full">
                <AudioFileUpload 
                  onFileSelect={handleFileUpload} 
                  isProcessing={isProcessing} 
                />
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-5 bg-slate-50/40 dark:bg-slate-900/10 border border-app-border/40 rounded-2xl w-full">
                {recordingMode === 'system' ? (
                  <div className="flex-1 text-left space-y-2.5 max-w-sm">
                    <p className="text-[10px] text-app-accent font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <HeadphonesIcon size={12} />
                      Configuração Virtual
                    </p>
                    <ul className="text-[11px] text-slate-500 dark:text-slate-450 space-y-1.5 leading-snug">
                      <li className="flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-250 dark:bg-slate-800 flex items-center justify-center font-bold text-[8px] text-slate-500 shrink-0">1</span>
                        <span>Partilhe o seu ecrã inteiro ou separador.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-250 dark:bg-slate-800 flex items-center justify-center font-bold text-[8px] text-slate-500 shrink-0">2</span>
                        <span className="text-app-accent font-bold">Ative "Partilhar áudio do sistema"!</span>
                      </li>
                    </ul>
                    <p className="text-[9px] text-amber-600 dark:text-amber-500/90 font-medium pt-1.5 leading-normal border-t border-slate-150 dark:border-white/5 mt-2">
                      {t('minimizeStreamWarning')}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 text-left space-y-1 max-w-sm">
                    <p className="text-sm font-black text-slate-850 dark:text-white">{language === 'portuguese' ? 'Gravação Presencial Local' : 'Local Mic Capture'}</p>
                    <p className="text-xs text-slate-450 leading-relaxed">{language === 'portuguese' ? 'Otimizado para conversas em sala, reuniões presenciais ou apresentações locais com diariamento de vozes.' : 'Optimized for in-room dialogue, speech clarity and live diarization using high-fidelity local mic.'}</p>
                  </div>
                )}

                {/* Centered recording button */}
                <div className="relative shrink-0 flex items-center justify-center py-4 px-6">
                  <div className="absolute w-32 h-32 rounded-full bg-app-accent/5 animate-pulse-ring pointer-events-none" />
                  <button
                    onClick={startRecording}
                    className="relative z-10 w-28 h-28 rounded-full bg-app-accent hover:opacity-95 text-white flex flex-col items-center justify-center shadow-lg hover:scale-102 transition-transform cursor-pointer border border-white/5 active:scale-98"
                  >
                    <Mic size={24} className="text-white" />
                    <span className="mt-2 font-mono text-[7px] tracking-[0.15em] uppercase font-bold opacity-90">{t('startSession')}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <div className="flex items-center gap-1.5">
                <Headphones size={12} className="text-app-green" />
                <span>Headset Optimized</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-app-green" />
                <span>AI Diarization Active</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Configuration & Parameters */}
          <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full min-h-[350px] text-left backdrop-blur-md">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Sliders size={12} className="text-app-accent" />
                {language === 'portuguese' ? 'Configuração e Filtros' : 'Session Parameters'}
              </h3>

              {/* Segmented control for sessionType */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-slate-900/40 p-1 rounded-xl border border-slate-200/40 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setSessionType('meeting')}
                  className={cn(
                    "py-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer",
                    sessionType === 'meeting'
                      ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/50 dark:border-white/5"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {t('sessionTypeMeeting')}
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('quick_draft')}
                  className={cn(
                    "py-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer",
                    sessionType === 'quick_draft'
                      ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/50 dark:border-white/5"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {t('sessionTypeQuickDraft')}
                </button>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {t('expectedSpeakersLabel')}
                </label>
                <input
                  type="text"
                  value={expectedSpeakers}
                  onChange={(e) => setExpectedSpeakers(e.target.value)}
                  placeholder={t('expectedSpeakersPlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-app-border rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-app-accent/20 font-medium"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {t('aiTemplateLabel')}
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-app-border rounded-xl px-3.5 py-2 text-xs text-slate-855 dark:text-white focus:outline-none focus:ring-1 focus:ring-app-accent/20 font-medium"
                >
                  <option value="standard">{t('templateStandard')}</option>
                  <option value="client_meeting">{t('templateClient')}</option>
                  <option value="internal_meeting">{t('templateInternal')}</option>
                  <option value="brainstorming">{t('templateBrainstorming')}</option>
                </select>
              </div>
            </div>

            {/* High-tech accuracy indicator */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between mt-4">
              <div>
                <p className="text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-widest">Diarization Engine</p>
                <p className="text-[9px] text-slate-400">{t('segmentationAccuracy')}</p>
              </div>
              
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="28" cy="28" r="22" stroke="rgba(55, 142, 107, 0.08)" strokeWidth="3" fill="transparent" />
                  <motion.circle 
                    cx="28" cy="28" r="22" 
                    stroke="var(--app-accent)" strokeWidth="3" fill="transparent" 
                    strokeDasharray={138}
                    initial={{ strokeDashoffset: 138 }}
                    animate={{ strokeDashoffset: 138 - (138 * 0.98) }}
                    transition={{ duration: 1.5 }}
                  />
                </svg>
                <span className="absolute text-[10px] font-mono font-black text-app-accent">98%</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Concentric Onion Ring (Session Distribution) */}
          <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full min-h-[350px] text-left backdrop-blur-md">
            <div className="space-y-1">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <PieChart size={12} className="text-app-accent" />
                Distribuição de Reuniões
              </h3>
              <p className="text-[9px] text-slate-400">Categorias das atas de reuniões analisadas</p>
            </div>

            {/* Concentric Onion Rings */}
            <div className="relative flex items-center justify-center h-44 my-2 shrink-0">
              <svg className="w-40 h-40 transform -rotate-90">
                {/* Standard Ring */}
                <circle cx="80" cy="80" r="65" stroke="rgba(55, 142, 107, 0.08)" strokeWidth="8" fill="transparent" />
                <motion.circle cx="80" cy="80" r="65" stroke="var(--app-accent)" strokeWidth="8" strokeDasharray={408} initial={{ strokeDashoffset: 408 }} animate={{ strokeDashoffset: 408 - (408 * 0.85) }} transition={{ duration: 1 }} fill="transparent" />
                
                {/* Client Ring */}
                <circle cx="80" cy="80" r="50" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="8" fill="transparent" />
                <motion.circle cx="80" cy="80" r="50" stroke="#6366f1" strokeWidth="8" strokeDasharray={314} initial={{ strokeDashoffset: 314 }} animate={{ strokeDashoffset: 314 - (314 * 0.65) }} transition={{ duration: 1, delay: 0.2 }} fill="transparent" />
                
                {/* Internal Ring */}
                <circle cx="80" cy="80" r="35" stroke="rgba(245, 158, 11, 0.08)" strokeWidth="8" fill="transparent" />
                <motion.circle cx="80" cy="80" r="35" stroke="#f59e0b" strokeWidth="8" strokeDasharray={220} initial={{ strokeDashoffset: 220 }} animate={{ strokeDashoffset: 220 - (220 * 0.45) }} transition={{ duration: 1, delay: 0.4 }} fill="transparent" />
                
                {/* Brainstorm Ring */}
                <circle cx="80" cy="80" r="20" stroke="rgba(236, 72, 153, 0.08)" strokeWidth="8" fill="transparent" />
                <motion.circle cx="80" cy="80" r="20" stroke="#ec4899" strokeWidth="8" strokeDasharray={125} initial={{ strokeDashoffset: 125 }} animate={{ strokeDashoffset: 125 - (125 * 0.35) }} transition={{ duration: 1, delay: 0.6 }} fill="transparent" />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-white">
                  {history.length > 0 ? `${history.length}` : '14'}
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Sessões</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--app-accent)] shrink-0" />
                <span className="truncate">Padrão ({history.filter(h => h.report.template === 'standard' || !h.report.template).length || 8})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
                <span className="truncate">Cliente ({history.filter(h => h.report.template === 'client_meeting').length || 3})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" />
                <span className="truncate">Interna ({history.filter(h => h.report.template === 'internal_meeting').length || 2})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ec4899] shrink-0" />
                <span className="truncate">Brainstorm ({history.filter(h => h.report.template === 'brainstorming').length || 1})</span>
              </div>
            </div>
          </div>

          {/* Bento Card 4: Meeting Frequency Chart */}
          <div className="col-span-1 md:col-span-2 bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col justify-between text-left backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart3 size={12} className="text-app-accent" />
                  Frequência de Uso
                </h3>
                <p className="text-[9px] text-slate-400">Minutos analisados nas últimas semanas</p>
              </div>
              <div className="flex gap-1.5">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold uppercase rounded text-slate-500">Equipa</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold uppercase rounded text-slate-500">Hoje</span>
              </div>
            </div>

            {/* Custom high contrast bars matching TeamTrack graph color styles */}
            <div className="h-28 flex items-end justify-between gap-3 px-2 pt-4">
              {[35, 45, 60, 25, 40, 80, 50, 65, 95, 40, 55, 75].map((height, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="relative w-full h-full flex items-end justify-center">
                    <motion.div 
                      className={cn(
                        "w-full rounded-t-lg transition-all duration-300",
                        idx === 8 ? "bg-app-accent" : "bg-app-accent/20 group-hover:bg-app-accent/40"
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.05 }}
                    />
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[8px] font-bold px-1.5 py-0.5 rounded transition-opacity pointer-events-none whitespace-nowrap font-mono z-10">
                      {Math.round(height * 0.6)} min
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 uppercase">{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][idx]}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Bento Sidebar (occupies col-span-4 on desktop) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Bento Card 5: My Tasks (Action items checker - Matches 'My Tasks' widget) */}
          <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col gap-4 text-left backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CheckSquare size={14} className="text-app-accent" />
                My Tasks
              </h3>
              <span className="text-[10px] bg-app-accent/10 text-app-accent px-2 py-0.5 rounded-full font-bold">
                {activeTasksCount} active
              </span>
            </div>

            {/* Tasks list */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Sem tarefas de momento.</p>
              ) : (
                tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-start justify-between gap-2.5 p-2.5 bg-slate-50/50 dark:bg-slate-900/20 border border-app-border rounded-2xl group hover:border-app-accent/20 transition-all"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button 
                        onClick={() => toggleTask(task.id)}
                        className="mt-0.5 shrink-0 text-slate-300 hover:text-app-accent transition-colors cursor-pointer"
                      >
                        {task.done ? (
                          <CheckCircle2 size={16} className="text-app-accent" />
                        ) : (
                          <Circle size={16} className="text-slate-300 dark:text-slate-700" />
                        )}
                      </button>
                      <div className="text-left min-w-0">
                        <p className={cn(
                          "text-xs font-semibold leading-tight break-words",
                          task.done ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-200"
                        )}>
                          {task.text}
                        </p>
                        <span className={cn("inline-block text-[8px] font-bold px-1.5 py-0.2 rounded mt-1", getBadgeStyles(task.category))}>
                          {task.category}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/5 text-slate-400 hover:text-red-500 transition-all cursor-pointer shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* New Task Inline Form */}
            <form onSubmit={addTask} className="flex gap-2 border-t border-slate-100 dark:border-white/5 pt-3.5 mt-1.5">
              <input 
                type="text" 
                placeholder="Adicionar nova tarefa..." 
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-900/40 border border-app-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-app-accent/25 text-slate-800 dark:text-white placeholder-slate-400 font-medium"
              />
              <button 
                type="submit"
                className="p-2.5 bg-app-accent hover:opacity-95 text-white rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
              >
                <Plus size={14} />
              </button>
            </form>
          </div>

          {/* Bento Card 6: Recent Meetings & Sessions schedule (Matches 'Meetings' on TeamTrack Right panel) */}
          <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-xs flex flex-col gap-4 text-left backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-app-accent" />
                Recent Meetings
              </h3>
              
              <button 
                onClick={() => handleOpenHistory()}
                className="text-[9px] font-extrabold text-app-accent uppercase tracking-widest hover:underline cursor-pointer"
              >
                {language === 'portuguese' ? 'Ver Tudo' : 'View All'}
              </button>
            </div>

            {/* Inline search bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input 
                type="text"
                placeholder={language === 'portuguese' ? 'Pesquisar atas...' : 'Search recent...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900/40 border border-app-border rounded-xl pl-9 pr-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-app-accent/20 transition-all text-slate-800 dark:text-white placeholder-slate-400 font-medium"
              />
            </div>

            {/* Meetings list */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1.5">
                  <Clock size={18} className="mx-auto opacity-50 text-app-accent" />
                  <p className="text-xs font-semibold">{t('noSessionsYet')}</p>
                  <p className="text-[10px] leading-snug">{t('startRecordingToBegin')}</p>
                </div>
              ) : (
                filteredHistory.slice(0, 4).map((item, idx) => {
                  // Determine meeting platform from clientName or idx
                  const platform = idx % 3 === 0 ? 'Google Meet' : idx % 3 === 1 ? 'Zoom' : 'In-Person';
                  const category = idx % 3 === 0 ? 'Marketing' : idx % 3 === 1 ? 'UI/UX Design' : 'Meeting';
                  return (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className="group flex flex-col p-3.5 bg-slate-50/50 dark:bg-slate-900/30 border border-app-border rounded-2xl cursor-pointer hover:border-app-accent/30 hover:shadow-xs transition-all relative overflow-hidden"
                    >
                      {/* Interactive hover accent glow line */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-app-accent transition-all" />
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase">
                          {new Date(item.date).toLocaleDateString(language === 'portuguese' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </span>
                        
                        <span className={cn("text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", getBadgeStyles(category))}>
                          {category}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-850 dark:text-white truncate leading-tight group-hover:text-app-accent transition-colors">
                        {item.title}
                      </h4>
                      
                      <p className="text-[10px] text-slate-450 line-clamp-1 mt-1 leading-relaxed">
                        {item.report.summary}
                      </p>

                      {/* Footer info: Avatar list + Platform */}
                      <div className="flex items-center justify-between border-t border-slate-100/60 dark:border-white/5 pt-2.5 mt-2.5">
                        {/* Avatar stack mockup */}
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          <div className="w-5 h-5 rounded-full bg-slate-200 border border-white dark:border-slate-900 flex items-center justify-center text-[7px] font-bold text-slate-600">A</div>
                          <div className="w-5 h-5 rounded-full bg-app-accent/20 border border-white dark:border-slate-900 flex items-center justify-center text-[7px] font-bold text-app-accent">B</div>
                          <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white dark:border-slate-900 flex items-center justify-center text-[7px] font-bold text-indigo-700">C</div>
                        </div>

                        <span className="text-[8px] font-extrabold text-slate-450 dark:text-slate-500 font-mono">
                          {platform}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Productivity tip card */}
            <div className="bg-app-accent/5 dark:bg-app-accent/10 border border-app-accent/15 rounded-2xl p-4 text-left">
              <p className="text-[10px] font-bold text-app-accent uppercase tracking-widest mb-1">Dica de Produtividade</p>
              <p className="text-xs font-semibold text-slate-750 dark:text-slate-200 leading-snug">
                {language === 'portuguese' 
                  ? 'Grave o áudio usando o template "Reunião com Cliente" para diariamento inteligente automático.' 
                  : 'Record audio using the "Client Meeting" template for precise automatic smart segment audits.'}
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
