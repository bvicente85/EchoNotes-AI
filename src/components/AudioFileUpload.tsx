import React, { useState, useRef } from 'react';
import { Upload, FileAudio, X, CheckCircle2, Loader2, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getBase64 } from '../services/audioProcessor';
import { useLanguage } from '../contexts/LanguageContext';

interface AudioFileUploadProps {
  onFileSelect: (base64: string, mimeType: string, options: { optimizeLowVolume: boolean }) => void;
  isProcessing: boolean;
}

export function AudioFileUpload({ onFileSelect, isProcessing }: AudioFileUploadProps) {
  const { t } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [optimizeLowVolume, setOptimizeLowVolume] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (selectedFile: File) => {
    setFileError(null);
    const isAudioType = selectedFile.type.startsWith('audio/') || 
      /\.(mp3|wav|m4a|aac|ogg|webm|flac|wma)$/i.test(selectedFile.name);

    if (!isAudioType) {
      setFileError("Por favor, selecione um ficheiro de áudio válido (.mp3, .wav, .m4a, .webm, .ogg, .aac).");
      return;
    }

    // 25MB max size check for Groq Whisper
    if (selectedFile.size > 25 * 1024 * 1024) {
      setFileError(`O ficheiro tem ${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB. O tamanho máximo permitido para transcrição é 25MB.`);
      return;
    }

    setFile(selectedFile);
  };

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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleProcess = async () => {
    if (!file) return;
    
    try {
      const base64 = await getBase64(file);
      const mimeType = file.type || 'audio/webm';
      onFileSelect(base64, mimeType, { optimizeLowVolume });
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
            ? "border-app-accent bg-app-accent/5 ring-4 ring-app-accent/5" 
            : "border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/60 hover:border-slate-350 dark:hover:border-white/10 hover:shadow-xs",
          file && "border-solid border-slate-200 dark:border-white/5 bg-app-accent/5"
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
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('uploadFile')}</h3>
              <p className="text-slate-400 dark:text-slate-400 text-xs mb-8 max-w-xs mx-auto leading-relaxed">
                {t('dragDropOrClick')}
              </p>

              {fileError && (
                <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium max-w-md mx-auto">
                  {fileError}
                </div>
              )}

              <button
                onClick={onButtonClick}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-50 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                {t('browseFilesButton')}
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
                <div className="w-10 h-10 bg-white dark:bg-slate-700 text-app-accent rounded-lg flex items-center justify-center border border-slate-200/40 dark:border-white/5 shrink-0">
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
                  className="p-1.5 hover:bg-app-accent/10 rounded-full transition-colors text-slate-400 hover:text-app-accent"
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
                      ? "bg-app-accent/10 dark:bg-app-accent/20 border-transparent text-slate-800 dark:text-white" 
                      : "bg-white dark:bg-[#1E293B] text-slate-500 border-slate-200/80 dark:border-white/5 hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    optimizeLowVolume ? "bg-white/40 dark:bg-app-accent/30" : "bg-slate-50 dark:bg-slate-800"
                  )}>
                    <Volume2 size={16} className={cn(optimizeLowVolume ? "text-app-accent" : "text-slate-400")} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{t('optimizeVolumeTitle')}</p>
                    <p className={cn(
                      "text-[10px] leading-tight mt-0.5",
                      optimizeLowVolume ? "text-slate-500 dark:text-slate-450" : "text-slate-400"
                    )}>
                      {t('optimizeVolumeDesc')}
                    </p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border transition-all flex items-center justify-center",
                    optimizeLowVolume ? "border-app-accent bg-app-accent" : "border-slate-200 dark:border-white/15"
                  )}>
                    {optimizeLowVolume && <CheckCircle2 className="text-white" size={12} />}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-50 text-white dark:text-slate-900 py-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {(() => {
                      const rawModel = localStorage.getItem('echonotes_ai_model');
                      const selectedModel = (rawModel && rawModel !== 'gemini-3.5-flash') ? rawModel : 'groq-llama-3.3';
                      const isGroq = selectedModel === 'groq-llama-3.3';
                      const isPortuguese = localStorage.getItem('echonotes_language') === 'portuguese';
                      
                      const buttonText = isGroq 
                        ? (isPortuguese ? 'Transcrever com Groq' : 'Transcribe with Groq')
                        : t('transcribeWithGemini');
                        
                      const runningText = isGroq
                        ? (isPortuguese ? 'Análise Groq em Execução...' : 'Groq Analysis Running...')
                        : t('geminiAnalysisRunning');

                      return isProcessing ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          {runningText}
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          {buttonText}
                        </>
                      );
                    })()}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase tracking-wider px-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-app-green" />
          {t('supportedFormatsText')}
        </div>
        <div>{t('maxSizeText')}</div>
      </div>
    </div>
  );
}
