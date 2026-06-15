import React, { useState, useRef } from 'react';
import { Upload, FileAudio, X, CheckCircle2, Loader2, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getBase64 } from '../services/audioProcessor';

interface AudioFileUploadProps {
  onFileSelect: (base64: string, mimeType: string, options: { optimizeLowVolume: boolean }) => void;
  isProcessing: boolean;
}

export function AudioFileUpload({ onFileSelect, isProcessing }: AudioFileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [optimizeLowVolume, setOptimizeLowVolume] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/')) {
        setFile(droppedFile);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleProcess = async () => {
    if (!file) return;
    
    try {
      const base64 = await getBase64(file);
      onFileSelect(base64, file.type, { optimizeLowVolume });
    } catch (error) {
      console.error("Error converting file to base64:", error);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div 
        className={cn(
          "relative group border border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px]",
          dragActive 
            ? "border-[#526C78] bg-[#526C78]/5 ring-4 ring-[#526C78]/5" 
            : "border-slate-200 dark:border-white/5 bg-white dark:bg-[#1E293B]/60 hover:border-slate-350 dark:hover:border-white/10 hover:shadow-sm",
          file && "border-solid border-slate-200 dark:border-white/5 bg-[#526C78]/5"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleChange}
        />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform border border-slate-200/50 dark:border-white/5">
                <Upload className="text-slate-400 dark:text-slate-300" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Carregar Gravação</h3>
              <p className="text-slate-400 dark:text-slate-400 text-xs mb-8 max-w-xs mx-auto leading-relaxed">
                Arraste e solte o ficheiro de áudio aqui, ou clique para procurar.
              </p>
              <button
                onClick={onButtonClick}
                className="bg-[#1E293B] hover:bg-[#334155] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-[#1E293B] px-6 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-98"
              >
                Procurar Ficheiros
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="file-selected"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200/50 dark:border-white/5 mb-6">
                <div className="w-10 h-10 bg-white dark:bg-slate-700 text-[#526C78] dark:text-slate-300 rounded-lg flex items-center justify-center border border-slate-200/40 dark:border-white/5 shrink-0">
                  <FileAudio size={20} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="p-1.5 hover:bg-rose-500/10 rounded-full transition-colors text-slate-400 hover:text-rose-500"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-6">
                <div 
                  onClick={() => setOptimizeLowVolume(!optimizeLowVolume)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border",
                    optimizeLowVolume 
                      ? "bg-[#526C78]/10 dark:bg-[#526C78]/20 border-transparent text-slate-800 dark:text-white" 
                      : "bg-white dark:bg-[#1E293B] text-slate-500 border-slate-200/80 dark:border-white/5 hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    optimizeLowVolume ? "bg-white/40 dark:bg-[#526C78]/30" : "bg-slate-50 dark:bg-slate-800"
                  )}>
                    <Volume2 size={16} className={cn(optimizeLowVolume ? "text-[#526C78] dark:text-slate-300" : "text-slate-400")} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Otimização de Voz</p>
                    <p className={cn(
                      "text-[10px] leading-tight mt-0.5",
                      optimizeLowVolume ? "text-slate-500 dark:text-slate-450" : "text-slate-400"
                    )}>
                      Melhora vozes baixas ou distantes automaticamente.
                    </p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border transition-all flex items-center justify-center",
                    optimizeLowVolume ? "border-[#526C78] bg-[#526C78]" : "border-slate-200 dark:border-white/15"
                  )}>
                    {optimizeLowVolume && <CheckCircle2 className="text-white" size={12} />}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full bg-[#1E293B] hover:bg-[#334155] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-[#1E293B] py-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Análise Gemini em curso...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Transcrever com Gemini
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase tracking-wider px-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" />
          Suporta WAV, MP3, AAC, WEBM, OGG
        </div>
        <div>Máximo 20MB</div>
      </div>
    </div>
  );
}
