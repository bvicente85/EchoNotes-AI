import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Headphones, Sparkles, History, Settings, Trash2, LogOut, User as UserIcon, Search, X, ArrowUpDown, LayoutGrid, ChevronDown, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateMeetingReport, MeetingReport, MeetingAnalysisError } from './services/gemini';
import { getSupabase } from './supabase';
import { User } from '@supabase/supabase-js';
import { ReportView } from './components/ReportView';
import { LoginPage } from './components/LoginPage';
import { SettingsView } from './components/SettingsView';
import { AdminDashboard } from './components/AdminDashboard';
import { AskGemini } from './components/AskGemini';
import { cn } from './lib/utils';
import { saveToHistory, getHistory, deleteFromHistory, updateHistoryItem, clearHistory, migrateFromLocalStorage, HistoryItem } from './services/storage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'mic' | 'system'>('mic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFailedAudio, setLastFailedAudio] = useState<{base64: string, mimeType: string} | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [report, setReport] = useState<MeetingReport | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(40).fill(0));
  const [waveform, setWaveform] = useState<number[]>(new Array(64).fill(128));
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [sortField, setSortField] = useState<'date' | 'title'>('date');
  const [displayName, setDisplayName] = useState(localStorage.getItem('echonotes_display_name') || '');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState(localStorage.getItem('echonotes_language') || 'portuguese');
  const [summaryDetail, setSummaryDetail] = useState(localStorage.getItem('echonotes_summary_detail') || 'detailed');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserSettings(session.user);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        loadUserSettings(currentUser);
      } else {
        // Clear theme on logout
        document.documentElement.classList.remove('dark');
        setIsAdmin(false);
        setShowAdminDashboard(false);
      }
      
      setAuthLoading(false);
    });

    const loadUserSettings = async (currentUser: User) => {
      // Check if admin by email
      if (currentUser.email === 'brunnofilipe@gmail.com') {
        setIsAdmin(true);
      }

      // Load settings from Supabase profiles table
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profile && !error) {
          if (profile.role === 'admin') {
            setIsAdmin(true);
          }
          if (profile.theme) {
            setTheme(profile.theme as 'light' | 'dark');
            if (profile.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
          if (profile.default_mode) setRecordingMode(profile.default_mode);
          if (profile.display_name) setDisplayName(profile.display_name);
          if (profile.language) setLanguage(profile.language);
          if (profile.summary_detail) setSummaryDetail(profile.summary_detail);
          
          // Sync with localStorage for legacy components
          if (profile.theme) localStorage.setItem('echonotes_theme', profile.theme);
          if (profile.default_mode) localStorage.setItem('echonotes_default_mode', profile.default_mode);
          if (profile.display_name) localStorage.setItem('echonotes_display_name', profile.display_name);
          if (profile.language) localStorage.setItem('echonotes_language', profile.language);
          if (profile.summary_detail) localStorage.setItem('echonotes_summary_detail', profile.summary_detail);
        } else {
          // Fallback to localStorage if no profile data yet
          const savedTheme = (localStorage.getItem('echonotes_theme') as 'light' | 'dark') || 'light';
          setTheme(savedTheme);
          if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }

          const savedDefaultMode = localStorage.getItem('echonotes_default_mode') as 'mic' | 'system' | null;
          if (savedDefaultMode) {
            setRecordingMode(savedDefaultMode);
          }

          const savedDisplayName = localStorage.getItem('echonotes_display_name');
          if (savedDisplayName) {
            setDisplayName(savedDisplayName);
          }
        }
      } catch (err) {
        console.error("Error loading user settings:", err);
      }
    };

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!showHistory) {
      setSearchQuery('');
    }
  }, [showHistory]);

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        // Try to migrate data from LocalStorage first
        const migrated = await migrateFromLocalStorage(user.id);
        if (migrated > 0) {
          console.log(`Migrated ${migrated} items from LocalStorage`);
        }
        
        const data = await getHistory(user.id);
        setHistory(data);
      };
      fetchHistory();
    }
  }, [user]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isProcessing) {
      setProcessingTime(0);
      processingTimerRef.current = window.setInterval(() => {
        setProcessingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
    }
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
    };
  }, [isProcessing]);

  const handleRetry = async () => {
    if (!lastFailedAudio || !user) return;
    
    setError(null);
    setIsProcessing(true);
    
    try {
      const detailLevel = localStorage.getItem('echonotes_summary_detail') || 'detailed';
      const language = localStorage.getItem('echonotes_language') || 'english';
      const result = await generateMeetingReport(lastFailedAudio.base64, lastFailedAudio.mimeType, detailLevel, language);
      
      setLastFailedAudio(null);
      const newItem = await saveToHistory(result, user.id);
      if (newItem) {
        setCurrentHistoryId(newItem.id);
        const updatedHistory = await getHistory(user.id);
        setHistory(updatedHistory);
      }
      setReport(result);
    } catch (err) {
      console.error("Retry failed:", err);
      if (err instanceof MeetingAnalysisError) {
        setError(err.message);
      } else {
        setError("Retry failed. The AI service might still be unavailable.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      let stream: MediaStream;
      
      if (recordingMode === 'system') {
        // Capture system/tab audio
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true, // Required for most browsers to show the audio checkbox
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Mix the streams
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();
          
          const micSource = audioContext.createMediaStreamSource(micStream);
          const systemSource = audioContext.createMediaStreamSource(screenStream);
          
          micSource.connect(destination);
          systemSource.connect(destination);
          
          // We only need the audio tracks
          stream = destination.stream;
          
          // Stop the video track immediately as we don't need it
          screenStream.getVideoTracks().forEach(track => track.stop());
          
          // Store original streams to stop them later
          (stream as any)._originalStreams = [micStream, screenStream];
        } catch (err) {
          console.error("System audio capture failed:", err);
          setError("To record a virtual meeting, you must select a tab/window and check 'Share audio'. Falling back to microphone only.");
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { 
            mimeType,
            audioBitsPerSecond: 16000 // Reduced to 16kbps to keep file sizes under 20MB limit for long meetings
          }) 
        : new MediaRecorder(stream, {
            audioBitsPerSecond: 16000
          });
        
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Average for the main ring
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);

        // Sample data for the waveform (40 bars)
        const step = Math.floor(dataArray.length / 40);
        const sampledData = [];
        for (let i = 0; i < 40; i++) {
          sampledData.push(dataArray[i * step] || 0);
        }
        setFrequencyData(sampledData);

        // Sample data for the time-domain waveform (64 points)
        const timeData = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(timeData);
        const sampledWaveform = [];
        const waveStep = Math.floor(timeData.length / 64);
        for (let i = 0; i < 64; i++) {
          sampledWaveform.push(timeData[i * waveStep] || 128);
        }
        setWaveform(sampledWaveform);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        console.log("Recording stopped. Chunks:", audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          setError("Nenhum dado de áudio capturado. Por favor, tente gravar novamente.");
          setIsProcessing(false);
          return;
        }

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log("Audio Blob size:", audioBlob.size, "MimeType:", mimeType);
        
        if (audioBlob.size < 1000) { // Very small blob, likely silent or empty
          setError("A gravação foi demasiado curta ou silenciosa. Por favor, tente novamente.");
          setIsProcessing(false);
          return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const resultStr = reader.result as string;
          if (!resultStr) {
            setError("Falha ao ler dados de áudio.");
            setIsProcessing(false);
            return;
          }
          
          const base64Audio = resultStr.split(',')[1];
          console.log("Starting AI analysis...");
          
          try {
            const detailLevel = localStorage.getItem('echonotes_summary_detail') || 'detailed';
            const language = localStorage.getItem('echonotes_language') || 'english';
            const result = await generateMeetingReport(base64Audio, mimeType, detailLevel, language);
            console.log("Analysis complete!");
            setLastFailedAudio(null); // Clear on success
            const newItem = await saveToHistory(result, user!.id);
            if (newItem) {
              setCurrentHistoryId(newItem.id);
              const updatedHistory = await getHistory(user!.id);
              setHistory(updatedHistory);
            } else {
              setError("O relatório foi gerado, mas não foi possível guardá-lo no histórico. Verifique a sua ligação ao Supabase.");
            }
            setReport(result);
          } catch (err) {
            console.error("Error generating report:", err);
            setLastFailedAudio({ base64: base64Audio, mimeType });
            if (err instanceof MeetingAnalysisError) {
              setError(err.message);
            } else {
              setError("Ocorreu um erro inesperado ao processar a reunião. Por favor, tente uma gravação mais curta.");
            }
          } finally {
            setIsProcessing(false);
          }
        };
        
        reader.onerror = () => {
          console.error("FileReader error");
          setError("Falha ao processar ficheiro de áudio.");
          setIsProcessing(false);
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        if ((stream as any)._originalStreams) {
          (stream as any)._originalStreams.forEach((s: MediaStream) => s.getTracks().forEach(t => t.stop()));
        }
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setFrequencyData(new Array(40).fill(0));
        setWaveform(new Array(64).fill(128));
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please enable it in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      const success = await deleteFromHistory(deleteConfirmId);
      if (success) {
        const updatedHistory = await getHistory(user!.id);
        setHistory(updatedHistory);
      }
      setDeleteConfirmId(null);
    }
  };

  const handleClearHistory = () => {
    setIsClearingAll(true);
  };

  const confirmClearAll = async () => {
    const success = await clearHistory(user!.id);
    if (success) {
      setHistory([]);
    }
    setIsClearingAll(false);
  };

  const handleStartEdit = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEdit = async (id: string, e?: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
    e?.stopPropagation();
    if (editingTitle.trim() === '') {
      setEditingId(null);
      return;
    }
    const success = await updateHistoryItem(id, { title: editingTitle });
    if (success) {
      const updatedHistory = await getHistory(user!.id);
      setHistory(updatedHistory);
    }
    setEditingId(null);
  };

  const handleManualCreate = async () => {
    const manualReport: MeetingReport = {
      summary: "Manual Entry",
      highlights: ["Manual highlight"],
      keyDecisions: ["Manual decision"],
      nextActions: ["Manual action"],
      transcript: [{ speaker: "User", text: "Manual entry created.", timestamp: "00:00" }]
    };
    const newItem = await saveToHistory(manualReport, user!.id);
    if (newItem) {
      const updatedHistory = await getHistory(user!.id);
      setHistory(updatedHistory);
      handleSelectHistory(newItem);
      setShowHistory(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setReport(item.report);
    setCurrentHistoryId(item.id);
    setShowHistory(false);
  };

  const handleUpdateReport = async (updatedReport: MeetingReport) => {
    setReport(updatedReport);
    if (currentHistoryId) {
      const success = await updateHistoryItem(currentHistoryId, { report: updatedReport });
      if (success) {
        const updatedHistory = await getHistory(user!.id);
        setHistory(updatedHistory);
      }
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (currentHistoryId) {
      const success = await updateHistoryItem(currentHistoryId, { title: newTitle });
      if (success) {
        const updatedHistory = await getHistory(user!.id);
        setHistory(updatedHistory);
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('echonotes_theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update profile if user is logged in
    if (user) {
      const supabase = getSupabase();
      await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', user.id);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  };

  const handleGoHome = () => {
    setReport(null);
    setError(null);
    setCurrentHistoryId(null);
    setIsRecording(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-app-green" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={cn(
      "min-h-screen bg-app-bg text-app-fg font-sans selection:bg-app-accent selection:text-white transition-colors duration-700",
      isRecording && "ring-inset ring-8 ring-red-500/5"
    )}>
      {/* Header */}
      <nav className="p-4 md:p-6 flex justify-between items-center border-b border-app-border bg-app-bg/50 backdrop-blur-md sticky top-0 z-40">
        <button 
          onClick={handleGoHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-app-dark-green rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles className="text-app-cream" size={16} />
          </div>
          <span className="font-bold tracking-tight text-lg md:text-xl truncate text-app-fg">EchoNotes</span>
        </button>
        <div className="flex items-center gap-3 md:gap-6 text-sm font-medium">
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-app-card border border-app-border flex items-center justify-center text-app-fg hover:text-app-green transition-all shadow-sm"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="h-4 w-px bg-app-border hidden xs:block" />

          <button 
            onClick={() => setShowHistory(true)}
            className="text-app-brown/60 hover:text-app-fg transition-colors flex items-center gap-2"
          >
            <History size={18} /> <span className="hidden sm:inline">History</span>
          </button>
          
          <div className="h-4 w-px bg-app-border hidden xs:block" />
          
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-9 h-9 rounded-full bg-app-card flex items-center justify-center border border-app-border group-hover:border-app-green transition-all shadow-sm">
                <UserIcon size={16} className="text-app-brown/60 group-hover:text-app-fg" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-app-fg max-w-[80px] md:max-w-[120px] truncate">
                  {displayName || user.email?.split('@')[0]}
                </span>
                <ChevronDown size={10} className={cn("text-app-brown/30 transition-transform", showUserMenu && "rotate-180")} />
              </div>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-app-card rounded-2xl shadow-2xl border border-app-border overflow-hidden z-50"
                  >
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => { setShowSettings(true); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-zinc-600 hover:text-app-fg hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                      >
                        <Settings size={16} />
                        <span className="text-xs font-bold">Settings</span>
                      </button>
                      
                      {isAdmin && (
                        <button 
                          onClick={() => { setShowAdminDashboard(true); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-zinc-600 hover:text-app-fg hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                        >
                          <LayoutGrid size={16} />
                          <span className="text-xs font-bold">Admin Panel</span>
                        </button>
                      )}

                      <div className="h-px bg-app-border my-1" />

                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      >
                        <LogOut size={16} />
                        <span className="text-xs font-bold">Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-app-card w-full max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:max-h-[80vh] mt-auto md:mt-0 border border-app-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 md:p-6 border-b border-app-border flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-4">
                  <h3 className="text-lg md:text-xl font-display font-bold text-app-fg">Meeting History</h3>
                  <button 
                    onClick={handleManualCreate}
                    className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-app-fg text-app-bg px-2 md:px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
                  >
                    + New
                  </button>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                  {history.length > 0 && (
                    <button 
                      onClick={handleClearHistory}
                      className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="text-zinc-400 hover:text-app-fg text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-6 py-3 border-b border-app-border bg-app-bg/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-brown/30" size={16} />
                  <input 
                    type="text"
                    placeholder="Search in titles, summaries, or transcripts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-app-card border border-app-border rounded-xl text-sm focus:ring-2 focus:ring-app-green/10 focus:border-app-green transition-all text-app-fg placeholder:text-app-brown/30"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-24 top-1/2 -translate-y-1/2 text-app-brown/30 hover:text-app-fg"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <select 
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as 'date' | 'title')}
                      className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 text-app-brown/40 cursor-pointer hover:text-app-fg"
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                    </select>
                    <button 
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        "text-app-brown/30 hover:text-app-fg hover:bg-app-bg"
                      )}
                      title={sortOrder === 'desc' ? "Descending" : "Ascending"}
                    >
                      <ArrowUpDown size={14} className={cn(sortOrder === 'asc' && "rotate-180 transition-transform")} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 font-normal italic">
                    No meetings recorded yet.
                  </div>
                ) : (() => {
                  const filteredHistory = history.filter(item => {
                    const searchLower = searchQuery.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(searchLower) ||
                      item.report.summary.toLowerCase().includes(searchLower) ||
                      (item.report.clientName && item.report.clientName.toLowerCase().includes(searchLower)) ||
                      item.report.highlights.some(h => h.toLowerCase().includes(searchLower)) ||
                      (item.report.keyDecisions && item.report.keyDecisions.some(d => d.toLowerCase().includes(searchLower))) ||
                      item.report.nextActions.some(a => a.toLowerCase().includes(searchLower)) ||
                      item.report.transcript.some(t => t.text.toLowerCase().includes(searchLower) || t.speaker.toLowerCase().includes(searchLower))
                    );
                  });

                  if (filteredHistory.length === 0) {
                    return (
                      <div className="text-center py-12 text-zinc-400 font-normal italic">
                        No results found for "{searchQuery}"
                      </div>
                    );
                  }

                  const sortedHistory = [...filteredHistory].sort((a, b) => {
                    if (sortField === 'date') {
                      const dateA = new Date(a.report.meetingDate || a.date).getTime();
                      const dateB = new Date(b.report.meetingDate || b.date).getTime();
                      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                    } else {
                      const titleA = a.title.toLowerCase();
                      const titleB = b.title.toLowerCase();
                      return sortOrder === 'asc' 
                        ? titleA.localeCompare(titleB)
                        : titleB.localeCompare(titleA);
                    }
                  });

                  return sortedHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className="group flex items-center justify-between p-4 rounded-xl hover:bg-app-cream border border-transparent hover:border-app-border cursor-pointer transition-all"
                    >
                      <div className="flex flex-col flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-black/40 uppercase tracking-widest">
                            {item.report.meetingDate 
                              ? new Date(item.report.meetingDate).toLocaleDateString() + ' • ' + new Date(item.report.meetingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date(item.date).toLocaleDateString() + ' • ' + new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          </span>
                          {item.report.clientName && (
                            <span className="text-[10px] font-bold text-app-green uppercase tracking-widest bg-app-green/10 px-1.5 py-0.5 rounded">
                              {item.report.clientName}
                            </span>
                          )}
                        </div>
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
                            <input 
                              autoFocus
                              value={editingTitle}
                              onChange={e => setEditingTitle(e.target.value)}
                              onBlur={(e) => handleSaveEdit(item.id, e)}
                              className="flex-1 bg-app-card border border-app-green rounded px-2 py-1 text-sm font-medium focus:outline-none ring-2 ring-app-green/5 text-black"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit(item.id, e);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button 
                              onMouseDown={e => e.preventDefault()} // Prevent blur before click
                              onClick={e => handleSaveEdit(item.id, e)}
                              className="text-xs font-bold text-app-green hover:opacity-80"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={(e) => handleStartEdit(item, e)}
                            className="text-black font-bold text-sm line-clamp-2 hover:text-app-green transition-colors cursor-text leading-tight"
                            title="Click to edit title"
                          >
                            {item.title}
                          </span>
                        )}
                        <p className="text-[11px] text-black/70 line-clamp-2 mt-1.5 font-normal leading-relaxed">
                          {item.report.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => handleStartEdit(item, e)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-black/20 hover:text-app-fg transition-all"
                        >
                          <Settings size={16} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-black/20 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsView 
            onClose={() => setShowSettings(false)} 
            userEmail={user.email || ''} 
            userId={user.id}
            onSignOut={handleSignOut}
            initialDisplayName={displayName}
            initialTheme={theme}
            initialMode={recordingMode}
            initialLanguage={language}
            initialSummaryDetail={summaryDetail}
            onSettingsUpdate={(newDisplayName, newTheme, newMode, newLanguage, newSummaryDetail) => {
              setDisplayName(newDisplayName);
              setTheme(newTheme as 'light' | 'dark');
              setRecordingMode(newMode as 'mic' | 'system');
              setLanguage(newLanguage);
              setSummaryDetail(newSummaryDetail);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminDashboard && (
          <AdminDashboard 
            onClose={() => setShowAdminDashboard(false)}
            onSelectMeeting={(item) => {
              handleSelectHistory(item);
              setShowAdminDashboard(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {(deleteConfirmId || isClearingAll) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-app-card w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-app-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2 text-app-fg">
                {isClearingAll ? 'Clear All History?' : 'Delete Meeting?'}
              </h3>
              <p className="text-zinc-500 text-sm mb-6">
                {isClearingAll 
                  ? 'This will permanently remove all your recorded meetings. This action cannot be undone.'
                  : 'Are you sure you want to delete this meeting report? This action cannot be undone.'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setIsClearingAll(false);
                  }}
                  className="flex-1 px-4 py-2 bg-app-bg hover:bg-app-card text-app-fg border border-app-border rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={isClearingAll ? confirmClearAll : confirmDelete}
                  className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {report ? (
        <ReportView 
          report={report} 
          title={history.find(h => h.id === currentHistoryId)?.title}
          onReset={handleGoHome} 
          onUpdate={handleUpdateReport}
          onUpdateTitle={handleUpdateTitle}
        />
      ) : (
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <AnimatePresence mode="wait">
            {!isProcessing ? (
              <motion.div 
                key="recording-ui"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full flex flex-col items-center gap-6 md:gap-8"
              >
                <div className="text-center space-y-3 max-w-2xl">
                  <h2 className="text-4xl md:text-5xl font-display font-bold leading-tight tracking-tighter text-black">
                    Capture every word, <br />
                    <span className="text-app-dark-green">understand every voice.</span>
                  </h2>
                  <p className="text-black/80 text-sm md:text-base font-normal px-4">
                    EchoNotes uses advanced AI to transcribe, identify speakers, and summarize your business meetings in real-time.
                  </p>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm max-w-md text-center flex flex-col gap-3 items-center shadow-sm"
                  >
                    <p>{error}</p>
                    {lastFailedAudio && (
                      <button 
                        onClick={handleRetry}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        Try Again
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Mode Toggle */}
                {!isRecording && (
                  <div className="flex bg-app-card p-1 rounded-xl border border-app-border shadow-sm">
                    <button 
                      onClick={() => setRecordingMode('mic')}
                      className={cn(
                        "px-6 py-2 rounded-lg text-sm font-medium transition-all",
                        recordingMode === 'mic' ? "bg-app-dark-green text-app-cream shadow-md" : "text-app-brown/40 hover:text-app-fg"
                      )}
                    >
                      In-Person
                    </button>
                    <button 
                      onClick={() => setRecordingMode('system')}
                      className={cn(
                        "px-6 py-2 rounded-lg text-sm font-medium transition-all",
                        recordingMode === 'system' ? "bg-app-dark-green text-app-cream shadow-md" : "text-app-brown/40 hover:text-app-fg"
                      )}
                    >
                      Virtual Meeting
                    </button>
                  </div>
                )}

                {recordingMode === 'system' && !isRecording && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-100 p-5 rounded-xl max-w-md text-center space-y-3 shadow-sm"
                  >
                    <p className="text-xs text-amber-800 font-bold uppercase tracking-wider">
                      How to capture meeting audio:
                    </p>
                    <div className="text-[11px] text-amber-700 leading-relaxed text-left space-y-2">
                      <p>1. Click <strong>Start Meeting</strong> below.</p>
                      <p>2. In the browser popup, click the <strong>"Entire Screen"</strong> tab at the top.</p>
                      <p>3. Click the <strong>image of your screen</strong> to select it.</p>
                      <p>4. <span className="text-amber-900 font-bold underline">Check the box</span> at the bottom that says <strong>"Share system audio"</strong>.</p>
                      <p>5. Click <strong>Share</strong>.</p>
                    </div>
                  </motion.div>
                )}

                {/* Visualizer / Status */}
                <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
                  <div className="absolute inset-0 border border-app-brown/5 rounded-full" />
                  
                  {/* LIVE Badge */}
                  {isRecording && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-app-bg px-3 py-1 rounded-full border border-rose-100 shadow-sm"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Live Recording</span>
                    </motion.div>
                  )}
                  
                  {/* Circular Waveform */}
                  {isRecording && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {frequencyData.map((value, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1 bg-app-green/40 rounded-full"
                          style={{
                            height: `${Math.max(4, value / 2)}px`,
                            transform: `rotate(${i * (360 / 40)}deg) translateY(-120px)`,
                            transformOrigin: '50% 120px'
                          }}
                          animate={{
                            height: `${Math.max(4, value / 2)}px`,
                            opacity: 0.2 + (value / 255) * 0.8
                          }}
                          transition={{ duration: 0.1 }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Audio Rings */}
                  {isRecording && (
                    <>
                      <motion.div 
                        animate={{ scale: [1, 1.1 + audioLevel/100, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="absolute inset-0 border border-app-green/20 rounded-full"
                      />
                    </>
                  )}

                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={cn(
                      "relative z-10 w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-500 group",
                      isRecording 
                        ? "bg-app-dark-green text-app-cream shadow-2xl shadow-app-green/40 ring-4 ring-app-green/10" 
                        : "bg-app-bg border border-app-border hover:border-app-green hover:shadow-xl text-app-fg"
                    )}
                  >
                    {isRecording ? (
                      <>
                        <Square fill="currentColor" size={32} />
                        <span className="mt-4 font-mono text-xs tracking-widest uppercase">Stop Session</span>
                      </>
                    ) : (
                      <>
                        <Mic size={32} />
                        <span className="mt-4 font-mono text-xs tracking-widest uppercase">Start Meeting</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4 w-full">
                  <div className={cn(
                    "font-mono text-2xl tracking-tighter transition-opacity duration-300",
                    isRecording ? "opacity-100" : "opacity-20"
                  )}>
                    {formatDuration(duration)}
                  </div>

                  {isRecording && (
                    <div className="flex flex-col gap-6 w-full items-center">
                      {/* Spectrum Analyzer */}
                      <div className="w-full max-w-xs h-16 flex items-end justify-center gap-[2px]">
                        {frequencyData.map((value, i) => (
                          <motion.div
                            key={i}
                            className="flex-1 bg-app-green/60 rounded-t-[1px]"
                            animate={{ height: `${(value / 255) * 100}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        ))}
                      </div>

                      {/* Waveform */}
                      <div className="w-full max-w-xs h-8 flex items-center justify-center gap-[1px]">
                        {waveform.map((value, i) => (
                          <motion.div
                            key={i}
                            className="w-[2px] bg-app-green/30 rounded-full"
                            animate={{ height: `${Math.max(2, Math.abs(value - 128) * 0.5)}px` }}
                            transition={{ duration: 0.1 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {isRecording && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] font-mono text-app-green uppercase tracking-[0.3em] animate-pulse"
                    >
                      Listening to conversation...
                    </motion.div>
                  )}
                  
                  <div className="flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-app-brown/40">
                    <div className="flex items-center gap-2">
                      <Headphones size={14} className={isRecording ? "text-app-green" : ""} />
                      <span>Headset Optimized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className={isRecording ? "text-app-green" : ""} />
                      <span>AI Diarization Active</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="processing-ui"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <div className="relative">
                  <Loader2 className="animate-spin text-app-brown/10" size={80} strokeWidth={1} />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-app-dark-green" size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-display font-bold text-app-fg">Synthesizing Intelligence...</h3>
                  <p className="text-app-brown/60 max-w-md mx-auto">
                    Our AI is currently separating speakers, analyzing key themes, and drafting your business report. 
                    <br />
                    <span className="text-xs font-mono mt-2 block">Processing time: {formatDuration(processingTime)}</span>
                  </p>
                </div>
                <div className="w-64 h-1 bg-app-brown/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-app-dark-green"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}

      {/* Footer Branding */}
      <footer className="fixed bottom-0 w-full p-6 text-[10px] font-mono uppercase tracking-[0.2em] text-app-brown/20 flex justify-between pointer-events-none">
        <span>Precision Audio Capture v1.0</span>
        <span>Secure End-to-End Analysis</span>
      </footer>

      {/* Ask Gemini Chat - Always visible */}
      <AskGemini report={report} historyItems={history} />
    </div>
  );
}
