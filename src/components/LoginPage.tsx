import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { getSupabase } from '../supabase';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { EchoNotesLogoIcon } from './EchoNotesLogo';

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

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 font-sans transition-colors duration-700 relative">
      {/* Floating Language Switcher */}
      <div className="absolute top-6 right-6 flex gap-1.5 z-50">
        <button
          onClick={() => setLanguage('portuguese')}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all border",
            language === 'portuguese'
              ? "bg-blue-600 dark:bg-blue-500 text-white border-transparent shadow-xs"
              : "glass text-app-fg/50 hover:text-app-fg border-slate-200/50 dark:border-white/5"
          )}
        >
          PT
        </button>
        <button
          onClick={() => setLanguage('english')}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all border",
            language === 'english'
              ? "bg-blue-600 dark:bg-blue-500 text-white border-transparent shadow-xs"
              : "glass text-app-fg/50 hover:text-app-fg border-slate-200/50 dark:border-white/5"
          )}
        >
          EN
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-app-card rounded-3xl shadow-2xl overflow-hidden border border-app-border">
          <div className="p-8 md:p-12">
            <div className="flex flex-col items-center mb-10">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-250/10 shadow-md text-[#114B5F] dark:text-[#38bdf8]">
                <EchoNotesLogoIcon className="w-11 h-11" />
              </div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-slate-800 dark:text-white">
                {isLogin ? t('welcomeBack') : t('createAccount')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 text-center">
                {isLogin ? t('signInToAccess') : t('startCapturing')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">{t('emailAddress')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-brown/40" size={18} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800 dark:text-white placeholder:text-app-brown/30"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-app-brown/40 ml-1">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-app-brown/30" size={18} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-app-fg placeholder:text-app-brown/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-rose-600 bg-rose-500/10 p-3 rounded-xl text-xs font-medium border border-rose-500/20"
                  >
                    <AlertCircle size={14} />
                    {error}
                  </motion.div>
                )}
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-emerald-600 bg-emerald-500/10 p-3 rounded-xl text-xs font-medium border border-emerald-500/20"
                  >
                    <Sparkles size={14} />
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {isLogin ? t('signIn') : t('createAccount')}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-app-brown/60 hover:text-app-fg transition-colors cursor-pointer"
              >
                {isLogin ? (
                  <>{t('dontHaveAccount')} <span className="font-bold text-blue-600 dark:text-blue-400">{t('createOne')}</span></>
                ) : (
                  <>{t('alreadyHaveAccount')} <span className="font-bold text-blue-600 dark:text-blue-400">{t('signIn')}</span></>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-center mt-8 text-app-brown/20 text-[10px] uppercase tracking-[0.2em]">
          {t('precisionAudio')}
        </p>
      </motion.div>
    </div>
  );
}
