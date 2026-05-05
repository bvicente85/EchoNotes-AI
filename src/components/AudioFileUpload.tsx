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
          "relative group border-2 border-dashed rounded-3xl p-10 transition-all duration-300 flex flex-col items-center justify-center min-h-[350px]",
          dragActive 
            ? "border-app-accent bg-app-accent/5 ring-4 ring-app-accent/10" 
            : "border-app-accent/20 glass hover:border-app-accent/40 hover:shadow-2xl",
          file && "border-solid border-app-accent/30 bg-app-accent/5"
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
              <div className="w-20 h-20 bg-app-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform">
                <Upload className="text-app-accent" size={32} />
              </div>
              <h3 className="text-2xl font-display font-black text-app-fg mb-3 tracking-tight">Upload Session</h3>
              <p className="text-app-fg/50 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
                Drag and drop your audio recording, or click to browse files.
              </p>
              <button
                onClick={onButtonClick}
                className="bg-app-accent text-app-light-gold px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-app-accent/20"
              >
                Browse Files
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="file-selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <div className="flex items-center gap-4 glass p-4 rounded-2xl shadow-sm border-app-accent/10 mb-6">
                <div className="w-12 h-12 bg-app-accent/10 text-app-accent rounded-xl flex items-center justify-center p-2">
                  <FileAudio size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-sm font-bold text-app-fg truncate">{file.name}</h4>
                  <p className="text-[10px] text-app-fg/40 font-mono uppercase tracking-wider">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="p-2 hover:bg-rose-500/10 rounded-full transition-colors text-app-fg/30 hover:text-rose-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div 
                  onClick={() => setOptimizeLowVolume(!optimizeLowVolume)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border",
                    optimizeLowVolume 
                      ? "bg-app-accent text-app-light-gold border-transparent shadow-2xl shadow-app-accent/20" 
                      : "glass text-app-fg/60 border-app-accent/5 hover:border-app-accent/20"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    optimizeLowVolume ? "bg-white/20" : "bg-app-accent/10"
                  )}>
                    <Volume2 size={20} className={cn(optimizeLowVolume ? "text-app-light-gold" : "text-app-accent")} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-tight">Audio Enhancement</p>
                    <p className={cn(
                      "text-[10px] leading-tight mt-0.5",
                      optimizeLowVolume ? "text-app-light-gold/70" : "text-app-fg/40"
                    )}>
                      Boosts clarity for quiet voices or distant speakers.
                    </p>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                    optimizeLowVolume ? "border-app-light-gold bg-app-light-gold" : "border-app-accent/20"
                  )}>
                    {optimizeLowVolume && <CheckCircle2 className="text-app-accent" size={16} />}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full bg-app-accent text-app-light-gold py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-app-accent/30 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Gemini analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Transcribe with Gemini
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between text-[10px] text-app-fg/40 font-black uppercase tracking-[0.2em] px-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={12} className="text-app-accent" />
          Supports WAV, MP3, AAC, WEBM, OGG
        </div>
        <div>Max 20MB per session</div>
      </div>
    </div>
  );
}
