import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Mail, Lock, ArrowRight, AlertCircle, Sliders, CheckCircle } from 'lucide-react';
import { getSupabase } from '../supabase';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = getSupabase();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: email.split('@')[0],
            }
          }
        });
        if (error) throw error;
        setMessage(t('creatingAccountSuccess'));
      }
    } catch (err: any) {
      setError(err.message || t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const features = language === 'portuguese' ? [
    {
      title: "Atas Inteligentes",
      description: "Sumários executivos, decisões e próximos passos estruturados com precisão.",
      icon: Sparkles
    },
    {
      title: "Múltiplos Modelos",
      description: "Formatos otimizados para Reuniões Executivas, Ideias e Notas Rápidas.",
      icon: Sliders
    },
    {
      title: "Qualidade Superior",
      description: "Fidelidade de áudio excecional e formatação automatizada.",
      icon: CheckCircle
    }
  ] : [
    {
      title: "AI Intelligent Minutes",
      description: "Executive summaries, decisions, and action items structured with precision.",
      icon: Sparkles
    },
    {
      title: "Multiple Templates",
      description: "Optimized formats for Executive Meetings, Brainstorming, and Action Items.",
      icon: Sliders
    },
    {
      title: "Superior AI Quality",
      description: "Exceptional transcription fidelity and automated text formatting.",
      icon: CheckCircle
    }
  ];

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-app-bg text-app-fg font-sans transition-colors duration-700 flex flex-col lg:flex-row relative">
      
      {/* Left side: Modern, Pristine Login Panel */}
      <div className="w-full lg:w-[42%] xl:w-[36%] lg:h-full flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 bg-app-bg relative z-10 transition-colors duration-700 border-r border-app-border/40 overflow-y-auto">
        
        {/* Navigation / Language Panel */}
        <div className="flex items-center justify-between w-full shrink-0">
          {/* Frameless Fluid logo integrated elegantly */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-display font-black tracking-tight text-slate-950 dark:text-white select-none">
              Echo<span className="text-app-accent">Notes</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-app-accent animate-pulse shrink-0" />
          </div>
          
          {/* Language Switcher selector */}
          <div className="flex gap-1 bg-white/60 dark:bg-slate-900/40 p-0.5 rounded-xl border border-app-border/40 backdrop-blur-md">
            <button
              onClick={() => setLanguage('portuguese')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black transition-all duration-300 cursor-pointer",
                language === 'portuguese'
                  ? "bg-app-accent text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              PT
            </button>
            <button
              onClick={() => setLanguage('english')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black transition-all duration-300 cursor-pointer",
                language === 'english'
                  ? "bg-app-accent text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              EN
            </button>
          </div>
        </div>

        {/* Central Sign-In / Register Form Box */}
        <div className="my-auto py-8 max-w-sm w-full mx-auto space-y-6 shrink-0">
          <div className="space-y-2 text-left">
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-slate-950 dark:text-white leading-tight">
              {isLogin ? t('welcomeBack') : t('createAccount')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
              {isLogin ? t('signInToAccess') : t('startCapturing')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-450 dark:text-slate-450 ml-1">
                {t('emailAddress')}
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-app-accent transition-colors duration-300" size={16} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-app-card border border-app-border rounded-xl pl-11 pr-4 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/15 focus:border-app-accent transition-all duration-300 text-slate-800 dark:text-white shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-450 dark:text-slate-450 ml-1">
                {t('password')}
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-app-accent transition-colors duration-300" size={16} />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-white dark:bg-app-card border border-app-border rounded-xl pl-11 pr-4 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/15 focus:border-app-accent transition-all duration-300 text-slate-800 dark:text-white shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-xl text-[11px] font-semibold border border-red-200 dark:border-red-900/30 text-left"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
              {message && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  className="flex items-center gap-2 text-app-green bg-app-green/10 p-3 rounded-xl text-[11px] font-semibold border border-app-green/20 text-left"
                >
                  <Sparkles size={14} className="shrink-0 text-app-green animate-pulse" />
                  <span>{message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-app-accent hover:bg-app-dark-green text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md shadow-app-accent/10 disabled:opacity-70 cursor-pointer active:scale-[0.99] group"
            >
              {loading ? (
                <Loader2 className="animate-spin text-white" size={18} />
              ) : (
                <>
                  <span className="tracking-wide">{isLogin ? t('signIn') : t('createAccount')}</span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="text-left pl-1">
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs sm:text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-300 cursor-pointer font-medium"
            >
              {isLogin ? (
                <>{t('dontHaveAccount')} <span className="font-bold text-app-accent hover:text-app-dark-green transition-colors duration-300 underline decoration-2 underline-offset-4">{t('createOne')}</span></>
              ) : (
                <>{t('alreadyHaveAccount')} <span className="font-bold text-app-accent hover:text-app-dark-green transition-colors duration-300 underline decoration-2 underline-offset-4">{t('signIn')}</span></>
              )}
            </button>
          </div>
        </div>

        {/* Right Footer */}
        <div className="text-left text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-[0.2em] font-black border-t border-app-border/40 pt-4 shrink-0">
          {t('precisionAudio')}
        </div>
      </div>

      {/* Right side: Premium Branding & Artwork with Harmonious Scale */}
      <div className="relative hidden lg:flex flex-col lg:w-[58%] xl:w-[64%] lg:h-full bg-slate-950 text-white p-10 xl:p-14 justify-between overflow-y-auto">
        
        {/* Decorative Background Mesh (Rich color flows aligned with app's colors) */}
        <div className="absolute inset-0 bg-[#070a11] z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[65%] h-[65%] rounded-full bg-app-accent/20 blur-[130px] animate-pulse" style={{ animationDuration: '9s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-app-brown/15 blur-[120px] animate-pulse" style={{ animationDuration: '14s' }} />
          <div className="absolute top-[30%] right-[10%] w-[45%] h-[45%] rounded-full bg-[#f59e0b]/8 blur-[110px] animate-pulse" style={{ animationDuration: '11s' }} />
          
          {/* Subtle Grid overlay for high-tech architectural depth */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-80" />
        </div>

        {/* Content Body - Center-focused with balanced padding & scale */}
        <div className="relative z-10 my-auto max-w-lg xl:max-w-xl w-full mx-auto space-y-10 py-8 shrink-0">
          
          {/* Headline and Narrative */}
          <div className="space-y-4 text-left">
            <div className="inline-flex items-center gap-2 bg-app-accent/10 text-app-accent px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-app-accent/20 shadow-inner">
              <Sparkles size={11} className="animate-pulse" />
              <span>EchoNotes AI Platform</span>
            </div>
            <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-display font-black tracking-tight text-white leading-[1.15] [text-shadow:0_4px_12px_rgba(0,0,0,0.15)]">
              {language === 'portuguese' 
                ? 'Transforme a sua voz em inteligência.' 
                : 'Transform your voice into intelligence.'}
            </h2>
            <p className="text-slate-300 text-xs xl:text-sm font-light leading-relaxed max-w-md xl:max-w-lg">
              {language === 'portuguese'
                ? 'Gere atas de reunião detalhadas, resumos estruturados e planos de ação em segundos usando o poder dos modelos generativos de IA.'
                : 'Generate detailed meeting minutes, structured summaries, and action plans in seconds using the power of generative AI.'}
            </p>
          </div>

          {/* Interactive Sound Wave Signal Visualizer (Enlarged and Proportional) */}
          <div className="bg-white/[0.02] backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden group text-left max-w-md xl:max-w-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-app-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex items-center justify-between mb-3.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-app-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-app-accent"></span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Speech Transcription Signal</span>
              </div>
              <span className="text-[10px] font-mono text-app-accent font-semibold">98% Accuracy</span>
            </div>
            
            {/* Pulsing soundwave bars (Height expanded to h-14 to feel rich and balanced) */}
            <div className="h-14 flex items-end gap-1.5 px-0.5 relative z-10">
              {[25, 45, 15, 60, 30, 80, 50, 95, 35, 70, 40, 85, 25, 90, 55, 75, 15, 65, 30, 45, 20, 50, 80, 40, 15, 60, 35, 80, 20].map((height, idx) => (
                <div 
                  key={idx} 
                  className="flex-1 bg-gradient-to-t from-app-accent to-app-accent/30 rounded-full animate-pulse"
                  style={{ 
                    height: `${height}%`,
                    animationDelay: `${idx * 0.05}s`,
                    animationDuration: `${0.7 + (idx % 4) * 0.3}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Core App Highlights (Perfectly Proportioned grid cells) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 text-left max-w-md xl:max-w-lg">
            {features.map((feat, i) => {
              const FeatIcon = feat.icon;
              return (
                <div key={i} className="flex gap-3 group">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-app-accent group-hover:bg-app-accent/15 group-hover:border-app-accent/25 transition-all duration-300 shadow-sm">
                    <FeatIcon size={16} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-app-accent transition-colors duration-300">{feat.title}</h4>
                    <p className="text-[11px] xl:text-xs text-slate-400 leading-relaxed font-light">{feat.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Footer */}
        <div className="relative z-10 flex items-center justify-between text-slate-500 text-[10px] border-t border-white/5 pt-4 shrink-0">
          <span className="font-mono tracking-wider uppercase">EchoNotes Inc. &copy; 2026</span>
          <span className="text-slate-400 font-medium">Powered by Gemini AI</span>
        </div>
      </div>

    </div>
  );
}
