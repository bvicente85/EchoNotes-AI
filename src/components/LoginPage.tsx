import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { getSupabase } from '../supabase';
import { cn } from '../lib/utils';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const supabase = getSupabase();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google authentication');
    } finally {
      setLoading(false);
    }
  };

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
        setMessage('Account created successfully! Please check your email.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 font-sans transition-colors duration-700">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-app-card rounded-3xl shadow-2xl overflow-hidden border border-app-border">
          <div className="p-8 md:p-12">
            <div className="flex flex-col items-center mb-10">
              <div className="w-12 h-12 bg-app-dark-green rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <Sparkles className="text-app-cream" size={24} />
              </div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-black">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-black/70 text-sm mt-2">
                {isLogin ? 'Sign in to access your meeting notes' : 'Start capturing your meetings with AI'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/60 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-brown/40" size={18} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-app-green/10 focus:border-app-green transition-all text-black placeholder:text-app-brown/30"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-app-brown/40 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-app-brown/30" size={18} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-app-green/10 focus:border-app-green transition-all text-app-fg placeholder:text-app-brown/20"
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
                className="w-full bg-app-dark-green text-app-cream rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-app-dark-green/10 disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-app-border"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                  <span className="bg-app-card px-4 text-app-brown/40">Or continue with</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-app-card border border-app-border text-app-fg rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-3 hover:bg-app-bg transition-all disabled:opacity-70"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23.5 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" fill="#4285F4"/>
                  <path d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.1C3.2 21.4 7.3 24 12 24z" fill="#34A853"/>
                  <path d="M5.2 14.3c-.2-.7-.4-1.4-.4-2.3s.2-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4-3.1z" fill="#FBBC05"/>
                  <path d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.6 1.2 6.6l4 3.1c1-2.9 3.7-5 6.8-5z" fill="#EA4335"/>
                </svg>
                Google
              </button>
            </form>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-app-brown/60 hover:text-app-fg transition-colors"
              >
                {isLogin ? (
                  <>Don't have an account? <span className="font-bold text-app-dark-green">Create one</span></>
                ) : (
                  <>Already have an account? <span className="font-bold text-app-dark-green">Sign in</span></>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-center mt-8 text-app-brown/20 text-[10px] uppercase tracking-[0.2em]">
          Precision Audio Capture & AI Analysis
        </p>
      </motion.div>
    </div>
  );
}
