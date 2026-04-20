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
          "relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px]",
          dragActive 
            ? "border-app-dark-green bg-app-dark-green/5 shadow-inner" 
            : "border-black/10 bg-white/50 hover:border-black/20",
          file && "border-solid border-app-dark-green/30 bg-app-dark-green/5"
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
              <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="text-black/40" size={28} />
              </div>
              <h3 className="text-xl font-bold text-black mb-2">Upload Audio File</h3>
              <p className="text-black/50 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                Drag and drop your meeting recording here, or click to browse files.
              </p>
              <button
                onClick={onButtonClick}
                className="bg-black text-white px-8 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-black/10 active:scale-95"
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
              <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-app-dark-green/10 mb-6">
                <div className="w-12 h-12 bg-app-dark-green/10 text-app-dark-green rounded-xl flex items-center justify-center p-2">
                  <FileAudio size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-sm font-bold text-black truncate">{file.name}</h4>
                  <p className="text-[10px] text-black/40 font-mono uppercase tracking-wider">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/30 hover:text-rose-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div 
                  onClick={() => setOptimizeLowVolume(!optimizeLowVolume)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border",
                    optimizeLowVolume 
                      ? "bg-app-dark-green text-app-cream border-transparent shadow-lg shadow-app-dark-green/20" 
                      : "bg-white text-black/60 border-black/5 hover:border-black/10"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    optimizeLowVolume ? "bg-white/20" : "bg-black/5"
                  )}>
                    <Volume2 size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Optimize for Low Volume</p>
                    <p className={cn(
                      "text-[10px] leading-tight mt-0.5",
                      optimizeLowVolume ? "text-app-cream/70" : "text-black/40"
                    )}>
                      Enhances transcription accuracy for quiet voices or distant recorders.
                    </p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                    optimizeLowVolume ? "border-white bg-white" : "border-black/20"
                  )}>
                    {optimizeLowVolume && <CheckCircle2 className="text-app-dark-green" size={14} />}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full bg-app-dark-green text-app-cream py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-95 transition-all shadow-xl shadow-app-dark-green/10 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Processing with Gemini AI...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Analyze Meeting with AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] text-black/30 font-bold uppercase tracking-widest px-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={12} className="text-app-dark-green/40" />
          Supports WAV, MP3, AAC, WEBM, OGG
        </div>
        <div>Max 20MB per file</div>
      </div>
    </div>
  );
}
