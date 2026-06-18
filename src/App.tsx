import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Headphones, Sparkles, History, Settings, Trash2, LogOut, User as UserIcon, Search, X, ArrowUpDown, LayoutGrid, ChevronDown, Sun, Moon, Upload, Monitor } from 'lucide-react';
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
import { useLanguage } from './contexts/LanguageContext';
import { getBackup, clearBackup, saveChunk, saveMetadata, BackupMetadata } from './services/dbBackup';
import { saveAudio, deleteAudio, clearAllAudios, cleanExpiredAudios } from './services/audioStorage';

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

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
  const { language, setLanguage, t } = useLanguage();
  const [summaryDetail, setSummaryDetail] = useState(localStorage.getItem('echonotes_summary_detail') || 'detailed');
  const [expectedSpeakers, setExpectedSpeakers] = useState('');
  const [activeBackup, setActiveBackup] = useState<{ chunks: Blob[]; metadata: BackupMetadata } | null>(null);
  const [audioInputQuality, setAudioInputQuality] = useState<'optimal' | 'too-low' | 'clipping'>('optimal');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastNormalVolumeTimeRef = useRef<number>(Date.now());
  const lastNormalClipTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const supabase = getSupabase();
    
    // Automatically clean up local audios older than 30 days
    cleanExpiredAudios(30).catch(console.error);
    
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
          if (profile.language && profile.language !== language) {
            setLanguage(profile.language);
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
    if (user) {
      const checkBackups = async () => {
        try {
          const backup = await getBackup();
          if (backup && backup.chunks.length > 0) {
            setActiveBackup(backup);
          }
        } catch (err) {
          console.error("Error reading IndexedDB backup:", err);
        }
      };
      checkBackups();
    }
  }, [user]);

  const handleRecoverBackup = async () => {
    if (!activeBackup || !user) return;
    
    const backup = activeBackup;
    setActiveBackup(null);
    setError(null);
    setIsProcessing(true);
    
    try {
      // Reconstruct the Blob from chunks saved in IndexedDB
      const audioBlob = new Blob(backup.chunks, { type: backup.metadata.mimeType });
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const detailLevel = localStorage.getItem('echonotes_summary_detail') || 'detailed';
        const languageSetting = localStorage.getItem('echonotes_language') || 'portuguese';
        
        try {
          const speakersArray = expectedSpeakers.split(',').map(s => s.trim()).filter(Boolean);
          const result = await generateMeetingReport(
            base64Audio, 
            audioBlob.type, 
            detailLevel, 
            languageSetting, 
            false, 
            speakersArray
          );
          
          const newItem = await saveToHistory(result, user.id);
          if (newItem) {
            setCurrentHistoryId(newItem.id);
            await saveAudio(newItem.id, audioBlob);
            const updatedHistory = await getHistory(user.id);
            setHistory(updatedHistory);
          }
          setReport(result);
          await clearBackup();
        } catch (err) {
          console.error("Recover processing failed:", err);
          if (err instanceof MeetingAnalysisError) {
            setError(err.message);
          } else {
            setError("Não foi possível processar a gravação recuperada.");
          }
          setLastFailedAudio({ base64: base64Audio, mimeType: audioBlob.type });
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err) {
      console.error("Failed to read reconstructed blob:", err);
      setError("Erro ao ler dados da gravação recuperada.");
      setIsProcessing(false);
    }
  };

  const handleDiscardBackup = async () => {
    await clearBackup();
    setActiveBackup(null);
  };

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
      const speakersArray = expectedSpeakers.split(',').map(s => s.trim()).filter(Boolean);
      const result = await generateMeetingReport(lastFailedAudio.base64, lastFailedAudio.mimeType, detailLevel, languageSetting, false, speakersArray);
      
      const reportBlob = base64ToBlob(lastFailedAudio.base64, lastFailedAudio.mimeType);
      setLastFailedAudio(null);
      const newItem = await saveToHistory(result, user.id);
      if (newItem) {
        setCurrentHistoryId(newItem.id);
        await saveAudio(newItem.id, reportBlob);
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
      const speakersArray = expectedSpeakers.split(',').map(s => s.trim()).filter(Boolean);
      
      const result = await generateMeetingReport(
        base64, 
        mimeType, 
        detailLevel, 
        languageSetting, 
        options.optimizeLowVolume,
        speakersArray
      );
      
      const newItem = await saveToHistory(result, user.id);
      if (newItem) {
        setCurrentHistoryId(newItem.id);
        try {
          const blob = base64ToBlob(base64, mimeType);
          await saveAudio(newItem.id, blob);
        } catch (err) {
          console.error("Failed to store uploaded audio local:", err);
        }
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

      // Clear any raw backups and store metadata right before starting
      await clearBackup();
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      await saveMetadata({ mimeType: actualMimeType, timestamp: Date.now() });

      // Reset audio quality metrics and timers on start
      lastNormalVolumeTimeRef.current = Date.now();
      lastNormalClipTimeRef.current = Date.now();
      setAudioInputQuality('optimal');

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
        let peakValue = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
          if (dataArray[i] > peakValue) {
            peakValue = dataArray[i];
          }
        }
        const currentLevel = sum / dataArray.length;
        setAudioLevel(currentLevel);

        // Quality monitor analysis
        const now = Date.now();
        const isCurrentlySilent = currentLevel < 4.5 && peakValue < 12;
        if (!isCurrentlySilent) {
          lastNormalVolumeTimeRef.current = now;
        }

        const isCurrentlyClipping = currentLevel > 180 || peakValue > 250;
        if (!isCurrentlyClipping) {
          lastNormalClipTimeRef.current = now;
        }

        let qualityStatus: 'optimal' | 'too-low' | 'clipping' = 'optimal';
        if (now - lastNormalVolumeTimeRef.current > 6000) {
          qualityStatus = 'too-low';
        } else if (now - lastNormalClipTimeRef.current > 2000) {
          qualityStatus = 'clipping';
        }
        
        setAudioInputQuality(qualityStatus);

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

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Save chunk dynamically into IndexedDB to guard against browser crashes
          await saveChunk(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioInputQuality('optimal');
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
              // Extract expected speakers array
              const speakersArray = expectedSpeakers.split(',').map(s => s.trim()).filter(Boolean);
              const res = await generateMeetingReport(base64Audio, audioBlob.type, detailLevel, languageSetting, false, speakersArray);
              const newItem = await saveToHistory(res, user!.id);
              if (newItem) {
                setCurrentHistoryId(newItem.id);
                try {
                  await saveAudio(newItem.id, audioBlob);
                } catch (err) {
                  console.error("Failed to store recorded audio locally:", err);
                }
                setHistory(prev => [newItem, ...prev]);
              }
              setReport(res);
              // Clear backup since processing succeeded and was saved to history
              await clearBackup();
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

      // Emit slices every 5 seconds to back up chunks sequentially to minimize potential data loss
      mediaRecorder.start(5000);
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
        await deleteAudio(deleteConfirmId);
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
        await clearAllAudios();
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
      <div className="flex flex-col min-h-screen">
        {/* Zen Header */}
        <header className="h-24 max-w-5xl mx-auto px-6 md:px-8 w-full flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-transparent border-none">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleGoHome}>
            <div className="w-9 h-9 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-350 border border-slate-205/20 shadow-xs transition-transform hover:scale-105">
              <Mic size={18} />
            </div>
            <div>
              <h1 className="text-lg font-sans font-semibold tracking-tight leading-none text-slate-800 dark:text-white">EchoNote</h1>
              <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-bold">INTELLIGENCE</span>
            </div>
          </div>

          {/* Minimal Navigation Pills */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-200/40 dark:border-white/5">
            <button 
              onClick={handleGoHome}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-98",
                !report 
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/50 dark:border-white/5" 
                  : "text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              <LayoutGrid size={14} />
              {t('dashboard')}
            </button>
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all active:scale-98"
            >
              <History size={14} />
              {t('sessionsNav')}
            </button>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {/* Theme switcher */}
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent hover:border-slate-200/40 dark:hover:border-white/5 transition-all"
              title={t('changeTheme')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Admin panel if admin */}
            {isAdmin && (
              <button 
                onClick={() => setShowAdminDashboard(true)}
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent hover:border-slate-200/40 dark:hover:border-white/5 transition-all"
                title={t('adminDashboardNav')}
              >
                <LayoutGrid size={18} />
              </button>
            )}

            {/* Settings gear */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent hover:border-slate-200/40 dark:hover:border-white/5 transition-all"
              title={t('settings')}
            >
              <Settings size={18} />
            </button>

            {/* User Account / Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200/40 dark:border-white/5 transition-all shrink-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600/50">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={12} className="text-slate-500 dark:text-slate-300" />
                  )}
                </div>
                <ChevronDown size={11} className={cn("text-slate-400 transition-transform", showUserMenu ? "rotate-180" : "")} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-xl p-4 z-50 space-y-3"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {t('profile')}
                        </p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{displayName || user.email}</p>
                      </div>
                      <hr className="border-slate-100 dark:border-white/5" />
                      <button 
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowSettings(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white text-left transition-colors"
                      >
                        <Settings size={14} />
                        {t('settings')}
                      </button>
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 text-left transition-colors"
                      >
                        <LogOut size={14} />
                        {t('signOut')}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">

      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-xs flex items-center justify-end"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-md h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200/80 dark:border-white/5 shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200/85 dark:border-white/5 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-white">{t('allSessions')}</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsClearingAll(true)}
                      className="p-2 text-[#526C78] dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      title={t('clearHistory')}
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-705 rounded-lg transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#526C78] transition-colors" size={16} />
                    <input 
                      type="text"
                      placeholder={t('searchPlaceholder')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200/75 dark:border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#526C78]/10 focus:border-[#526C78] transition-all text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <button 
                      onClick={() => {
                        setSortField(sortField === 'date' ? 'title' : 'date');
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-[#526C78] transition-colors"
                    >
                      <ArrowUpDown size={11} />
                      {t('sortBy')}: {sortField === 'date' ? t('date') : t('title')}
                    </button>
                    <button 
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-[#526C78] transition-colors"
                    >
                      {sortOrder === 'desc' ? t('mostRecent') : t('leastRecent')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-200/40 dark:border-white/5">
                      <History size={24} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-1">{t('noSessionsYet')}</h3>
                    <p className="text-xs text-slate-400">{t('startRecordingToBegin')}</p>
                  </div>
                ) : (() => {
                  if (sortedHistory.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <p className="text-xs text-slate-400">{t('noSessionsMatch')}</p>
                      </div>
                    );
                  }
                  return sortedHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-white/5 hover:border-[#6CA0BB]/60 hover:shadow-xs cursor-pointer rounded-xl transition-all"
                    >
                      <div className="flex flex-col flex-1 mr-4 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-455 uppercase tracking-wider">
                            {item.report.meetingDate 
                              ? new Date(item.report.meetingDate).toLocaleDateString() + ' • ' + new Date(item.report.meetingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date(item.date).toLocaleDateString() + ' • ' + new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          </span>
                          {item.report.clientName && (
                            <span className="text-[8px] font-bold text-[#526C78] dark:text-slate-300 uppercase tracking-wider bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
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
                              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-[#526C78] rounded px-2.5 py-1 text-xs font-medium focus:outline-none ring-2 ring-[#526C78]/10 text-slate-800 dark:text-white"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit(item.id, e);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button 
                              onMouseDown={e => e.preventDefault()}
                              onClick={e => handleSaveEdit(item.id, e)}
                              className="text-xs font-bold text-slate-800 dark:text-white hover:opacity-85"
                            >
                              {t('save')}
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={(e) => handleStartEdit(item, e)}
                            className="text-slate-800 dark:text-zinc-200 font-semibold text-sm line-clamp-1 hover:text-[#526C78] dark:hover:text-white transition-colors cursor-text leading-tight"
                            title={t('clickToEditTitle')}
                          >
                            {item.title}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-450 dark:text-slate-400 line-clamp-1 mt-1 font-normal leading-relaxed">
                          {item.report.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => handleStartEdit(item, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all rounded"
                          title={t('rename')}
                        >
                          <Settings size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 transition-all rounded"
                          title={t('delete')}
                        >
                          <Trash2 size={14} />
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
                {isClearingAll ? t('confirmDeleteAllTitle') : t('confirmDeleteTitle')}
              </h3>
              <p className="text-zinc-500 text-sm mb-6">
                {isClearingAll 
                  ? t('confirmDeleteAllDesc')
                  : t('confirmDeleteDesc')}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setIsClearingAll(false);
                  }}
                  className="flex-1 px-4 py-2 bg-app-bg hover:bg-app-card text-app-fg border border-app-border rounded-xl font-bold transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={isClearingAll ? confirmClearAll : confirmDelete}
                  className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recovery Backup Modal */}
      <AnimatePresence>
        {activeBackup && (
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
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2 text-app-fg">
                {t('recoveryTitle')}
              </h3>
              <p className="text-zinc-500 text-xs md:text-sm mb-6 leading-relaxed text-left">
                {t('recoveryDesc')}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDiscardBackup}
                  className="flex-1 px-4 py-2 bg-app-bg hover:bg-app-card text-rose-500 border border-app-border rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  {t('discardRecovery')}
                </button>
                <button 
                  onClick={handleRecoverBackup}
                  className="flex-1 px-4 py-2 bg-[#526C78] hover:bg-[#3d515a] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  {t('recoverButton')}
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
          meetingId={currentHistoryId || undefined}
          onReset={handleGoHome} 
          onUpdate={handleUpdateReport}
          onUpdateTitle={handleUpdateTitle}
        />
      ) : (
        <main className="max-w-5xl mx-auto px-8 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
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
                  <h2 className="text-3xl md:text-4xl font-sans font-bold leading-tight tracking-tight text-slate-800 dark:text-white">
                    {t('recordMeetingsTitle')} <br />
                    <span className="text-[#526C78] dark:text-slate-350">{t('extractIntelligence')}</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-normal px-4 max-w-lg mx-auto">
                    {t('dashboardDesc')}
                  </p>
                </div>

                {!isRecording && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-xs space-y-2 text-left"
                  >
                    <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                      {t('expectedSpeakersLabel')}
                    </label>
                    <input
                      type="text"
                      value={expectedSpeakers}
                      onChange={(e) => setExpectedSpeakers(e.target.value)}
                      placeholder={t('expectedSpeakersPlaceholder')}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400/50"
                    />
                  </motion.div>
                )}

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
                  <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-white/5 mb-4">
                    <button 
                      onClick={() => setRecordingMode('mic')}
                      className={cn(
                        "px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 active:scale-98",
                        recordingMode === 'mic' 
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm border border-slate-200/40 dark:border-white/10" 
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      <Mic size={14} />
                      {t('inPerson')}
                    </button>
                    <button 
                      onClick={() => setRecordingMode('system')}
                      className={cn(
                        "px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 active:scale-98",
                        recordingMode === 'system' 
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm border border-slate-200/40 dark:border-white/10" 
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      <Headphones size={14} />
                      {t('virtualMeeting')}
                    </button>
                    <button 
                      onClick={() => setRecordingMode('upload')}
                      className={cn(
                        "px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 active:scale-98",
                        recordingMode === 'upload' 
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm border border-slate-200/40 dark:border-white/10" 
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      <Upload size={14} />
                      {t('uploadFile')}
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
                        className="glass p-6 rounded-2xl max-w-md text-center space-y-4 shadow-xl mb-4"
                      >
                        <p className="text-xs text-app-brown font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                          <Monitor size={14} className="text-app-accent" />
                          Virtual Meeting Setup
                        </p>
                        <div className="text-[12px] text-app-fg/70 leading-relaxed text-left space-y-3">
                          <p className="flex gap-3"><span className="w-5 h-5 flex-shrink-0 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-bold">1</span> <span>Click <strong>Start Meeting</strong> below.</span></p>
                          <p className="flex gap-3"><span className="w-5 h-5 flex-shrink-0 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-bold">2</span> <span>In the browser popup, click the <strong>"Entire Screen"</strong> tab.</span></p>
                          <p className="flex gap-3"><span className="w-5 h-5 flex-shrink-0 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-bold">3</span> <span>Click the <strong>image of your screen</strong> to select it.</span></p>
                          <p className="flex gap-3"><span className="w-5 h-5 flex-shrink-0 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-bold">4</span> <span><span className="text-app-accent font-black underline decoration-2">Check the box</span> at the bottom: <strong>"Share system audio"</strong>.</span></p>
                          <p className="flex gap-3"><span className="w-5 h-5 flex-shrink-0 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-bold">5</span> <span>Click <strong>Share</strong> to begin.</span></p>
                        </div>
                      </motion.div>
                    )}

                    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                      <div className="absolute inset-0 border border-app-accent/10 rounded-full" />
                      
                      {isRecording && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 glass px-4 py-1.5 rounded-full border border-rose-500/20 shadow-lg"
                        >
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Live Recording</span>
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
                          "relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 group active:scale-98",
                          isRecording 
                            ? "bg-rose-500 text-white shadow-lg overflow-hidden border border-rose-400" 
                            : "bg-[#1E293B] hover:bg-[#334155] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#1E293B] shadow-md border border-slate-200/20 dark:border-white/5"
                        )}
                      >
                        {/* Premium Button Glass/Bevel Effect */}
                        {!isRecording && (
                          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                        )}
                        
                        {isRecording ? (
                          <>
                            <motion.div 
                              initial={{ scale: 0.8 }}
                              animate={{ scale: [0.8, 1.1, 0.8] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 bg-white/10 rounded-full"
                            />
                            <Square fill="currentColor" size={32} className="relative z-10" />
                            <span className="mt-4 font-mono text-[9px] tracking-[0.2em] uppercase font-bold relative z-10">{t('stopSession')}</span>
                          </>
                        ) : (
                          <>
                            <Mic size={32} className="relative z-10" />
                            <span className="mt-4 font-mono text-[9px] tracking-[0.2em] uppercase font-bold relative z-10">{t('startSession')}</span>
                            <div className="absolute bottom-10 w-12 h-0.5 bg-slate-300/30 rounded-full overflow-hidden">
                              <motion.div 
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="w-full h-full bg-current opacity-60"
                              />
                            </div>
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
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full max-w-xs flex flex-col gap-2 p-3.5 bg-slate-500/5 dark:bg-slate-400/5 border border-slate-500/10 rounded-2xl"
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span>{t('sessionProgress')}</span>
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{t('sessionDurationHint')}</span>
                          </div>
                          
                          {/* Progress bar container */}
                          <div className="relative w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 mb-2">
                            {/* Filling progress */}
                            <motion.div 
                              className="absolute left-0 top-0 h-full bg-app-green rounded-full shadow-[0_0_8px_rgba(30,172,130,0.3)]"
                              style={{ width: `${Math.min(100, (duration / 3600) * 100)}%` }}
                              layout
                            />
                            
                            {/* Tick Marks for 15, 30, 45, 60 minutes */}
                            <div className="absolute inset-0 flex justify-between px-0 pointer-events-none">
                              {/* 15m */}
                              <div className="absolute left-[25%] -translate-x-1/2 -top-1">
                                <div className={cn(
                                  "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 text-[7px] font-bold",
                                  duration >= 900 
                                    ? "bg-app-green border-app-green text-white" 
                                    : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400"
                                )}>
                                  15
                                </div>
                              </div>
                              {/* 30m */}
                              <div className="absolute left-[50%] -translate-x-1/2 -top-1">
                                <div className={cn(
                                  "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 text-[7px] font-bold",
                                  duration >= 1800 
                                    ? "bg-app-green border-app-green text-white" 
                                    : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400"
                                )}>
                                  30
                                </div>
                              </div>
                              {/* 45m */}
                              <div className="absolute left-[75%] -translate-x-1/2 -top-1">
                                <div className={cn(
                                  "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 text-[7px] font-bold",
                                  duration >= 2700 
                                    ? "bg-app-green border-app-green text-white" 
                                    : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400"
                                )}>
                                  45
                                </div>
                              </div>
                              {/* 60m */}
                              <div className="absolute left-[100%] -translate-x-1/2 -top-1">
                                <div className={cn(
                                  "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all duration-300 text-[7px] font-bold",
                                  duration >= 3600 
                                    ? "bg-app-green border-app-green text-white" 
                                    : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400"
                                )}>
                                  60
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Phases labels */}
                          <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 px-0.5">
                            <span className={cn(duration < 900 ? "text-app-green font-bold" : "")}>Intro</span>
                            <span className={cn(duration >= 900 && duration < 2700 ? "text-app-green font-bold" : "")}>Body</span>
                            <span className={cn(duration >= 2700 ? "text-app-green font-bold" : "")}>Wrap-up</span>
                          </div>
                        </motion.div>
                      )}

                      {isRecording && (
                        <div className="flex flex-col gap-4 w-full items-center max-w-xs transition-all duration-300">
                          {/* Audio Input Quality Monitor */}
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "w-full flex flex-col gap-1 items-start px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all duration-300 shadow-xs",
                              audioInputQuality === 'optimal' 
                                ? "bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : audioInputQuality === 'too-low'
                                ? "bg-amber-500/5 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse"
                                : "bg-rose-500/5 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-bounce"
                            )}
                          >
                            <div className="w-full flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "flex h-2 w-2 rounded-full",
                                  audioInputQuality === 'optimal' 
                                    ? "bg-emerald-500" 
                                    : audioInputQuality === 'too-low' 
                                    ? "bg-amber-500" 
                                    : "bg-rose-500"
                                )} />
                                <span className="font-bold uppercase tracking-wider text-[9px] opacity-80">{t('audioQualityStatus')}</span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                {audioInputQuality === 'optimal' && "OK"}
                                {audioInputQuality === 'too-low' && "LOW VOLUME"}
                                {audioInputQuality === 'clipping' && "CLIPPING"}
                              </span>
                            </div>
                            <span className="text-[10px] leading-snug mt-0.5 opacity-90 text-left font-medium">
                              {audioInputQuality === 'optimal' && t('audioQualityOptimal')}
                              {audioInputQuality === 'too-low' && t('audioQualityWarningTooLow')}
                              {audioInputQuality === 'clipping' && t('audioQualityWarningClipping')}
                            </span>
                          </motion.div>

                          {/* Dynamic Waveform Visualizer */}
                          <div className="w-full h-16 flex items-end justify-center gap-[2px]">
                            {frequencyData.map((value, i) => (
                              <motion.div
                                key={i}
                                className={cn(
                                  "flex-1 rounded-t-[1px] transition-colors duration-200",
                                  audioInputQuality === 'optimal' 
                                    ? "bg-emerald-500/60" 
                                    : audioInputQuality === 'too-low' 
                                    ? "bg-amber-500/50" 
                                    : "bg-rose-500/80"
                                )}
                                animate={{ height: `${Math.max(4, (value / 255) * 100)}%` }}
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
                  <h3 className="text-3xl font-display font-bold text-app-fg">{t('synthesizingIntelligence')}</h3>
                  <p className="text-app-brown/60 max-w-md mx-auto">
                    {t('processingDesc')}
                    <br />
                    <span className="text-xs font-mono mt-2 block">{t('processingTime')}: {formatDuration(processingTime)}</span>
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

        </div>
      </div>
      
      <AskGemini report={report} historyItems={history} />
    </div>
  );
}
