import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Sparkles, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MeetingReport, askGemini } from '../services/gemini';
import { HistoryItem } from '../services/storage';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AskGeminiProps {
  report: MeetingReport | null;
  historyItems?: HistoryItem[];
}

export const AskGemini: React.FC<AskGeminiProps> = ({ report, historyItems = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset messages when report changes
  useEffect(() => {
    setMessages([]);
  }, [report?.summary]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      // Map messages to Gemini history format
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const response = await askGemini(query, report, historyItems, chatHistory);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Desculpe, ocorreu um erro ao processar a sua pergunta. Por favor, tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-app-accent text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <Sparkles className="group-hover:animate-pulse" size={24} />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-bounce" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatRef}
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="fixed bottom-6 right-6 w-[calc(100vw-48px)] sm:w-[400px] h-[600px] max-h-[calc(100vh-48px)] glass rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 transition-colors"
          >
            {/* Header */}
            <div className="p-4 bg-slate-800 dark:bg-slate-900 text-white flex items-center justify-between shadow-sm border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest leading-none">Ask Gemini</h3>
                  <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest mt-1">AI Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-black/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-12 h-12 bg-app-accent/10 rounded-2xl flex items-center justify-center text-app-accent">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-app-fg">Ask about your meetings</p>
                    <p className="text-xs text-app-fg/40 mt-1">"What did we decide about EcoInsight?" or "Compare this to my previous meeting."</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    msg.role === 'user' ? "bg-app-accent/10 text-app-accent" : "glass text-app-fg/40"
                  )}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-[#526C78] dark:bg-[#526C78]/20 dark:border dark:border-[#526C78]/30 text-white rounded-tr-none font-medium" 
                      : "glass text-app-fg rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex gap-3 mr-auto max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg glass text-app-accent flex items-center justify-center flex-shrink-0">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div className="p-3 glass text-app-fg/60 rounded-2xl rounded-tl-none text-sm italic">
                    Gemini is thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 glass rounded-b-3xl">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your question..."
                  className="w-full pl-4 pr-12 py-3 glass rounded-2xl text-sm focus:ring-4 focus:ring-app-accent/10 focus:border-app-accent transition-all text-app-fg"
                />
                <button
                  onClick={handleSend}
                  disabled={!query.trim() || isLoading}
                  className="absolute right-2 p-2 bg-[#526C78] dark:bg-[#6CA0BB] text-white dark:text-[#0F172A] rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[9px] text-app-fg/30 text-center mt-3 uppercase tracking-[0.3em] font-black">
                Powered by Gemini
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
