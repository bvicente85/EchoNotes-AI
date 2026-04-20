import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Headphones, Sparkles, History, Settings, Trash2, LogOut, User as UserIcon, Search, X, ArrowUpDown, LayoutGrid, ChevronDown, Sun, Moon, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateMeetingReport, MeetingReport, MeetingAnalysisError } from './services/gemini';
import { AudioFileUpload } from './components/AudioFileUpload';
import { getSupabase } from './supabase';
import { User } from '@supabase/supabase-js';
import { ReportView } from './components/ReportView';
import { AskGemini } from './components/AskGemini';
import { LoginPage } from './components/LoginPage';
import { SettingsView } from './components/SettingsView';
import { AdminDashboard } from './components/AdminDashboard';
import { saveToHistory, getHistory, deleteFromHistory, updateHistoryItem, clearHistory, HistoryItem, migrateFromLocalStorage } from './services/storage';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'mic' | 'system' | 'upload'>('mic');
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
          if (profile.display_name) {
            setDisplayName(profile.display_name);
            localStorage.setItem('echonotes_display_name', profile.display_name);
          }
          if (profile.theme) {
            setTheme(profile.theme as 'light' | 'dark');
            if (profile.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
          if (profile.recording_mode) {
             setRecordingMode(profile.recording_mode as 'mic' | 'system');
          }
          if (profile.language) {
            setLanguage(profile.language);
            localStorage.setItem('echonotes_language', profile.language);
          }
          if (profile.summary_detail) {
            setSummaryDetail(profile.summary_detail);
            localStorage.setItem('echonotes_summary_detail', profile.summary_detail);
          }
        }
      } catch (err) {
        console.error("Error loading user settings:", err);
      }
    };

    return () => {
      subscription.unsubscribe();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
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
      const languageSetting = localStorage.getItem('echonotes_language') || 'portuguese';
      const result = await generateMeetingReport(lastFailedAudio.base64, lastFailedAudio.mimeType, detailLevel, languageSetting);
      
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

  const handleFileUpload = async (base64: string, mimeType: string, options: { optimizeLowVolume: boolean }) => {
    if (!user) return;
    
    setError(null);
    setIsProcessing(true);
    
    try {
      const detailLevel = localStorage.getItem('echonotes_summary_detail') || 'detailed';
      const languageSetting = localStorage.getItem('echonotes_language') || 'portuguese';
      
      const result = await generateMeetingReport(
        base64, 
        mimeType, 
        detailLevel, 
        languageSetting, 
        options.optimizeLowVolume
      );
      
      const newItem = await saveToHistory(result, user.id);
      if (newItem) {
        setCurrentHistoryId(newItem.id);
        const updatedHistory = await getHistory(user.id);
        setHistory(updatedHistory);
      }
      setReport(result);
    } catch (err) {
      console.error("Upload processing failed:", err);
      if (err instanceof MeetingAnalysisError) {
        setError(err.message);
      } else {
        setError("Failed to analyze the audio file. Make sure it's a valid audio format and its size is under 20MB.");
      }
      setLastFailedAudio({ base64, mimeType });
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      let stream: MediaStream;
      
      if (recordingMode === 'system') {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();
          const micSource = audioContext.createMediaStreamSource(micStream);
          const systemSource = audioContext.createMediaStreamSource(screenStream);
          micSource.connect(destination);
          systemSource.connect(destination);
          
          stream = destination.stream;
          screenStream.getVideoTracks().forEach(track => track.stop());
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

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 16000
      });
        
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateVisualization = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        setAudioLevel(sum / dataArray.length);

        const resizedData = [];
        const step = Math.floor(dataArray.length / 40);
        for (let i = 0; i < 40; i++) {
          resizedData.push(dataArray[i * step]);
        }
        setFrequencyData(resizedData);

        const timeData = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(timeData);
        const resizedWaveform = [];
        const wStep = Math.floor(timeData.length / 64);
        for (let i = 0; i < 64; i++) {
          resizedWaveform.push(timeData[i * wStep]);
        }
        setWaveform(resizedWaveform);

        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      };

      updateVisualization();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        // Final tracks cleanup
        stream.getTracks().forEach(track => track.stop());
        if ((stream as any)._originalStreams) {
          (stream as any)._originalStreams.forEach((s: MediaStream) => s.getTracks().forEach(t => t.stop()));
        }

        setIsProcessing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const detailLevel = localStorage.getItem('echonotes_summary_detail') || 'detailed';
            const languageSetting = localStorage.getItem('echonotes_language') || 'portuguese';
            
            try {
              const res = await generateMeetingReport(base64Audio, audioBlob.type, detailLevel, languageSetting);
              const newItem = await saveToHistory(res, user!.id);
              if (newItem) {
                setCurrentHistoryId(newItem.id);
                setHistory(prev => [newItem, ...prev]);
              }
              setReport(res);
            } catch (err) {
              console.error("Processing failed:", err);
              if (err instanceof MeetingAnalysisError) {
                setError(err.message);
              } else {
                setError("O serviço de IA está temporariamente indisponível. Por favor, tente novamente em alguns instantes.");
              }
              setLastFailedAudio({ base64: base64Audio, mimeType: audioBlob.type });
            } finally {
              setIsProcessing(false);
            }
          };
        } catch (err) {
          console.error("Recording stop handling failed:", err);
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Start recording failed:", err);
      setError("Não foi possível aceder ao microfone. Por favor, verifique as permissões do seu navegador.");
      setIsRecording(false);
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

  const handleGoHome = () => {
    setReport(null);
    setCurrentHistoryId(null);
  };

  const handleUpdateReport = async (updatedReport: MeetingReport) => {
    if (currentHistoryId && user) {
      await updateHistoryItem(currentHistoryId, { report: updatedReport });
      setReport(updatedReport);
      const updatedHistory = await getHistory(user.id);
      setHistory(updatedHistory);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (currentHistoryId && user) {
      const success = await updateHistoryItem(currentHistoryId, { title: newTitle });
      if (success) {
        const updatedHistory = await getHistory(user.id);
        setHistory(updatedHistory);
      }
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setReport(item.report);
    setCurrentHistoryId(item.id);
    setShowHistory(false);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId && user) {
      const success = await deleteFromHistory(deleteConfirmId);
      if (success) {
        setHistory(prev => prev.filter(item => item.id !== deleteConfirmId));
        if (currentHistoryId === deleteConfirmId) {
          handleGoHome();
        }
      }
      setDeleteConfirmId(null);
    }
  };

  const confirmClearAll = async () => {
    if (user) {
      const success = await clearHistory(user.id);
      if (success) {
        setHistory([]);
        handleGoHome();
      }
      setIsClearingAll(false);
    }
  };

  const handleStartEdit = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEdit = async (id: string, e: React.FormEvent | React.FocusEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim() || !user) {
      setEditingId(null);
      return;
    }
    
    const success = await updateHistoryItem(id, { title: editingTitle });
    if (success) {
      setHistory(prev => prev.map(item => item.id === id ? { ...item, title: editingTitle } : item));
    }
    setEditingId(null);
  };

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  };

  const sortedHistory = [...history]
    .filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.report.summary.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === 'date') {
        return sortOrder === 'desc' 
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        return sortOrder === 'desc'
          ? b.title.localeCompare(a.title)
          : a.title.localeCompare(b.title);
      }
    });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-app-dark-green" size={40} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={`min-h-screen bg-app-bg text-app-fg transition-colors duration-300 font-sans ${theme === 'dark' ? 'dark' : ''}`}>
      <nav className="h-20 border-b border-app-border px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleGoHome}>
          <div className="w-10 h-10 bg-app-dark-green rounded-xl flex items-center justify-center text-app-cream shadow-lg shadow-app-green/20 group-hover:scale-105 transition-transform">
            <Mic size={20} className="group-hover:animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-tighter leading-none text-black">EchoNote</h1>
            <span className="text-[10px] font-mono text-app-dark-green uppercase tracking-[0.2em] font-bold">AI Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setShowAdminDashboard(true)}
              className="p-2.5 text-black/40 hover:text-black hover:bg-app-cream rounded-xl transition-all"
              title="Admin Dashboard"
            >
              <LayoutGrid size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-app-cream hover:bg-black/5 rounded-xl transition-all border border-app-border"
          >
            <History size={18} className="text-black/60" />
            <span className="text-sm font-bold text-black/80">Recents</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-xl bg-app-card border border-app-border flex items-center justify-center overflow-hidden hover:border-black/20 transition-all shadow-sm"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={20} className="text-black/30" />
              )}
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-app-border p-2 z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-app-border mb-1">
                      <p className="text-xs font-bold text-black truncate">{displayName || user.email}</p>
                      <p className="text-[10px] text-black/40 truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowSettings(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 text-sm text-black/60 hover:text-black hover:bg-app-cream rounded-xl transition-all"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setShowAdminDashboard(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-sm text-black/60 hover:text-black hover:bg-app-cream rounded-xl transition-all"
                      >
                        <LayoutGrid size={16} />
                        Admin Panel
                      </button>
                    )}
                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 p-3 text-sm text-rose-500 hover:bg-rose-50 rounded-xl transition-all mt-1"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-end"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md h-full bg-app-bg shadow-2xl flex flex-col border-l border-app-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-app-border bg-white/50 backdrop-blur-md">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-display font-black tracking-tight text-black">History</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsClearingAll(true)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Clear all history"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="p-2 text-black/20 hover:text-black hover:bg-app-cream rounded-xl transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-app-dark-green transition-colors" size={18} />
                    <input 
                      type="text"
                      placeholder="Search meetings..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-app-border rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-app-green/5 focus:border-app-dark-green transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setSortField(sortField === 'date' ? 'title' : 'date');
                      }}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                    >
                      <ArrowUpDown size={12} />
                      Sorted by {sortField}
                    </button>
                    <button 
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                    >
                      {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-app-cream rounded-3xl flex items-center justify-center text-black/10 mb-4">
                      <History size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-black mb-1">No meetings yet</h3>
                    <p className="text-sm text-black/40">Start your first recording to see history.</p>
                  </div>
                ) : (() => {
                  if (sortedHistory.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <p className="text-sm text-black/40">No matches for your search.</p>
                      </div>
                    );
                  }
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
                              onMouseDown={e => e.preventDefault()}
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
            initialMode={recordingMode === 'upload' ? 'mic' : recordingMode}
            initialLanguage={language}
            initialSummaryDetail={summaryDetail}
            onSettingsUpdate={(newDisplayName, newTheme, newMode, newLanguage, newSummaryDetail) => {
              setDisplayName(newDisplayName);
              setTheme(newTheme as 'light' | 'dark');
              if (newMode !== 'upload') setRecordingMode(newMode as 'mic' | 'system');
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

                {!isRecording && (
                  <div className="flex bg-app-card p-1 rounded-xl border border-app-border shadow-sm mb-4">
                    <button 
                      onClick={() => setRecordingMode('mic')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                        recordingMode === 'mic' ? "bg-app-dark-green text-app-cream shadow-md" : "text-app-brown/40 hover:text-app-fg"
                      )}
                    >
                      <Mic size={14} />
                      In-Person
                    </button>
                    <button 
                      onClick={() => setRecordingMode('system')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                        recordingMode === 'system' ? "bg-app-dark-green text-app-cream shadow-md" : "text-app-brown/40 hover:text-app-fg"
                      )}
                    >
                      <Headphones size={14} />
                      Virtual Meeting
                    </button>
                    <button 
                      onClick={() => setRecordingMode('upload')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                        recordingMode === 'upload' ? "bg-app-dark-green text-app-cream shadow-md" : "text-app-brown/40 hover:text-app-fg"
                      )}
                    >
                      <Upload size={14} />
                      Upload File
                    </button>
                  </div>
                )}

                {recordingMode === 'upload' ? (
                  <AudioFileUpload 
                    onFileSelect={handleFileUpload} 
                    isProcessing={isProcessing} 
                  />
                ) : (
                  <div className="flex flex-col items-center gap-8">
                    {recordingMode === 'system' && !isRecording && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50 border border-amber-100 p-5 rounded-xl max-w-md text-center space-y-3 shadow-sm mb-4"
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

                    <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
                      <div className="absolute inset-0 border border-app-brown/5 rounded-full" />
                      
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
                        </div>
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
                  </div>
                )}
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

      <footer className="fixed bottom-0 w-full p-6 text-[10px] font-mono uppercase tracking-[0.2em] text-app-brown/20 flex justify-between pointer-events-none">
        <span>Precision Audio Capture v1.0</span>
        <span>Secure End-to-End Analysis</span>
      </footer>

      <AskGemini report={report} historyItems={history} />
    </div>
  );
}
