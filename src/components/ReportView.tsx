import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, ListFilter, MessageSquare, Download, FileJson, Plus, Trash2, Copy, Check, Undo, Redo, Gavel, Hash, User, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { MeetingReport } from '../services/gemini';
import { jsPDF } from 'jspdf';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface ReportViewProps {
  report: MeetingReport;
  title?: string;
  onReset: () => void;
  onUpdate?: (updatedReport: MeetingReport) => void;
  onUpdateTitle?: (newTitle: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, title: initialTitle, onReset, onUpdate, onUpdateTitle }) => {
  const { language, t } = useLanguage();
  const { 
    state: data, 
    update: updateData, 
    undo, 
    redo, 
    reset, 
    canUndo, 
    canRedo 
  } = useUndoRedo({
    summary: report.summary,
    highlights: report.highlights,
    keyDecisions: report.keyDecisions || [],
    nextActions: report.nextActions,
    transcript: report.transcript,
    clientName: report.clientName || '',
    meetingDate: report.meetingDate || new Date().toISOString().slice(0, 16),
    title: initialTitle || 'Meeting Intelligence Report'
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState<number | null>(null);
  const [editingSpeakerValue, setEditingSpeakerValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(true);

  useEffect(() => {
    reset({
      summary: report.summary,
      highlights: report.highlights,
      keyDecisions: report.keyDecisions || [],
      nextActions: report.nextActions,
      transcript: report.transcript,
      clientName: report.clientName || '',
      meetingDate: report.meetingDate || new Date().toISOString().slice(0, 16),
      title: initialTitle || 'Meeting Intelligence Report'
    });
  }, [report, initialTitle, reset]);

  // Auto-resize textareas on mount
  useEffect(() => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [data.transcript, data.summary]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Auto-save changes if onUpdate is provided
  useEffect(() => {
    if (onUpdate) {
      const timer = setTimeout(() => {
        onUpdate({
          ...report,
          summary: data.summary,
          highlights: data.highlights,
          nextActions: data.nextActions,
          transcript: data.transcript,
          clientName: data.clientName,
          meetingDate: data.meetingDate
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data.summary, data.highlights, data.nextActions, data.transcript, data.clientName, data.meetingDate, onUpdate, report]);

  useEffect(() => {
    if (onUpdateTitle && data.title !== initialTitle) {
      const timer = setTimeout(() => {
        onUpdateTitle(data.title);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data.title, onUpdateTitle, initialTitle]);

  const getReportText = () => {
    let text = `
MEETING INTELLIGENCE REPORT
===========================

`;
    if (data.clientName) {
      text += `CLIENT: ${data.clientName}\n`;
    }
    
    const formattedDate = new Date(data.meetingDate).toLocaleString();
    text += `DATE: ${formattedDate}\n`;
    text += `\n`;

    text += `EXECUTIVE SUMMARY
-----------------
${data.summary}

KEY HIGHLIGHTS
--------------
${data.highlights.map((h) => `• ${h}`).join('\n')}

KEY DECISIONS
-------------
${data.keyDecisions.map((d) => `✓ ${d}`).join('\n')}

NEXT ACTIONS
------------
${data.nextActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}
`;

    if (includeTranscript) {
      text += `
FULL TRANSCRIPT
---------------
${data.transcript.map(t => `[${t.timestamp}] ${t.speaker.toUpperCase()}: ${t.text}`).join('\n\n')}
`;
    }

    return text.trim();
  };

  const getMarkdownReport = () => {
    let md = `# ${data.title}\n\n`;
    
    if (data.clientName) {
      md += `**Client:** ${data.clientName}  \n`;
    }
    
    const formattedDate = new Date(data.meetingDate).toLocaleString();
    md += `**Date:** ${formattedDate}\n\n`;
    
    md += `## Executive Summary\n${data.summary}\n\n`;
    
    md += `## Key Highlights\n`;
    data.highlights.forEach(h => {
      md += `* ${h}\n`;
    });
    md += `\n`;

    md += `## Key Decisions\n`;
    data.keyDecisions.forEach(d => {
      md += `* ${d}\n`;
    });
    md += `\n`;

    md += `## Next Actions\n`;
    data.nextActions.forEach((a, i) => {
      md += `${i + 1}. ${a}\n`;
    });
    md += `\n`;

    if (includeTranscript) {
      md += `## Full Transcript\n\n`;
      data.transcript.forEach(t => {
        md += `**[${t.timestamp}] ${t.speaker.toUpperCase()}**\n${t.text}\n\n`;
      });
    }

    return md.trim();
  };

  const copyToClipboard = async (format: 'text' | 'markdown' = 'text') => {
    try {
      const content = format === 'markdown' ? getMarkdownReport() : getReportText();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadMarkdown = () => {
    const content = getMarkdownReport();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // meeting-report-NOME DO CLIENTE-data de realzação.md
    const clientName = data.clientName ? data.clientName.trim().replace(/[^a-z0-9]/gi, '-') : 'General';
    const dateStr = new Date(data.meetingDate).toISOString().split('T')[0];
    
    link.download = `meeting-report-${clientName}-${dateStr}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    const content = getReportText();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    link.download = `meeting-report${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPos = 20;

    // Helper for multi-line text
    const addWrappedText = (text: string, fontSize: number, isBold = false, color = [0, 0, 0]) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(color[0], color[1], color[2]);
      
      const lines = doc.splitTextToSize(text, contentWidth);
      
      // Check for page break
      if (yPos + (lines.length * (fontSize * 0.5)) > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPos = margin;
      }
      
      doc.text(lines, margin, yPos);
      yPos += lines.length * (fontSize * 0.5) + 5;
    };

    // Title
    doc.setFont('times', 'italic');
    doc.setFontSize(24);
    doc.text('Meeting Intelligence Report', margin, yPos);
    yPos += 15;

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const formattedDate = new Date(data.meetingDate).toLocaleString();
    doc.text(`Meeting Date: ${formattedDate}`, margin, yPos);
    yPos += 7;
    
    if (data.clientName) {
      doc.text(`Client: ${data.clientName}`, margin, yPos);
      yPos += 7;
    }
    
    yPos += 3;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // Summary
    addWrappedText('EXECUTIVE SUMMARY', 12, true, [100, 100, 100]);
    addWrappedText(data.summary, 11, false, [20, 20, 20]);
    yPos += 5;

    // Highlights
    addWrappedText('KEY HIGHLIGHTS', 12, true, [100, 100, 100]);
    data.highlights.forEach((h, i) => {
      addWrappedText(`${i + 1}. ${h}`, 10, false, [40, 40, 40]);
    });
    yPos += 5;

    // Next Actions
    addWrappedText('NEXT ACTIONS', 12, true, [100, 100, 100]);
    data.nextActions.forEach((a) => {
      addWrappedText(`[ ] ${a}`, 10, false, [40, 40, 40]);
    });
    yPos += 10;

    // Transcript
    if (includeTranscript) {
      addWrappedText('FULL TRANSCRIPT', 12, true, [100, 100, 100]);
      data.transcript.forEach((t) => {
        doc.setFontSize(9);
        doc.setFont('courier', 'bold');
        doc.setTextColor(150, 150, 150);
        doc.text(`[${t.timestamp}] ${t.speaker.toUpperCase()}`, margin, yPos);
        yPos += 5;
        
        addWrappedText(t.text, 10, false, [60, 60, 60]);
        yPos += 2;
      });
    }

    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    doc.save(`meeting-report${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.pdf`);
  };

  const downloadJSON = () => {
    const exportData = {
      title: data.title,
      clientName: data.clientName,
      date: data.meetingDate,
      summary: data.summary,
      highlights: data.highlights,
      nextActions: data.nextActions,
      transcript: includeTranscript ? data.transcript : undefined
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    link.download = `meeting-report${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadOnlyTranscript = () => {
    const text = data.transcript.map(t => `[${t.timestamp}] ${t.speaker.toUpperCase()}: ${t.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    link.download = `meeting-transcript${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSpeakerClick = (index: number, currentName: string) => {
    setEditingSpeakerIndex(index);
    setEditingSpeakerValue(currentName);
  };

  const handleSpeakerSave = (index: number) => {
    const newName = editingSpeakerValue.trim();
    if (newName && newName !== data.transcript[index].speaker) {
      const oldName = data.transcript[index].speaker;
      
      // Update all instances of this speaker name in the transcript
      const newTranscript = data.transcript.map(entry => 
        entry.speaker === oldName ? { ...entry, speaker: newName } : entry
      );
      updateData({ ...data, transcript: newTranscript });
    }
    setEditingSpeakerIndex(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-32 font-sans text-slate-800 dark:text-slate-200"
    >
      {/* Header Section: Minimalist & Clean Title & Metadata */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-white/5 pb-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em] rounded-md border border-slate-200/50 dark:border-white/5">
                {t('sessionAnalysis')}
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                {new Date(data.meetingDate).toLocaleDateString(language === 'portuguese' ? "pt" : "en") + " • " + new Date(data.meetingDate).toLocaleTimeString(language === 'portuguese' ? "pt" : "en", {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
            {isEditingTitle ? (
              <input
                autoFocus
                value={data.title}
                onChange={(e) => updateData({ ...data, title: e.target.value })}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false);
                  if (e.key === 'Escape') {
                    updateData({ ...data, title: initialTitle || t('intelligenceReport') });
                    setIsEditingTitle(false);
                  }
                }}
                className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-slate-400 dark:border-slate-505 focus:outline-none w-full py-1 tracking-tight"
              />
            ) : (
              <h1 
                onClick={() => setIsEditingTitle(true)}
                className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-slate-600 dark:hover:text-amber-500 transition-colors leading-tight tracking-tight break-words"
              >
                {data.title}
              </h1>
            )}
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onReset}
              className="p-3 border border-slate-200/80 dark:border-white/5 hover:bg-rose-500/10 hover:text-rose-600 text-slate-400 dark:text-slate-400 rounded-xl transition-colors bg-white dark:bg-slate-900"
              title={t('discardReport')}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Global Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-550" />
              {t('clientNameLabel')}
            </label>
            <input
              type="text"
              value={data.clientName}
              onChange={(e) => updateData({ ...data, clientName: e.target.value })}
              placeholder={t('clientNamePlaceholder')}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 tracking-tight"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-550" />
              {t('sessionTimeline')}
            </label>
            <input
              type="datetime-local"
              value={data.meetingDate}
              onChange={(e) => updateData({ ...data, meetingDate: e.target.value })}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-semibold text-slate-800 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark] tracking-tight"
            />
          </div>
        </div>

        {/* Custom, Clean Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('speakers')}</p>
              <User size={14} className="text-slate-400 dark:text-slate-550" />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {data.transcript.reduce((acc, t) => acc.add(t.speaker), new Set()).size}
            </p>
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('interactions')}</p>
              <MessageSquare size={14} className="text-slate-400 dark:text-slate-550" />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {data.transcript.length}
            </p>
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('decisions')}</p>
              <Gavel size={14} className="text-slate-400 dark:text-slate-550" />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {data.keyDecisions.length}
            </p>
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('pendingActions')}</p>
              <CheckCircle2 size={14} className="text-slate-400 dark:text-slate-550" />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {data.nextActions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Core Content: Summary & Decisions */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Executive Insight Box */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500 w-4 h-4 shrink-0" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('executiveSummary')}</h2>
              </div>
              <button 
                onClick={() => setIsEditingSummary(!isEditingSummary)}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-lg transition-all bg-white dark:bg-slate-900 shadow-sm"
              >
                {isEditingSummary ? t('save') : t('editSummaryWord')}
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl p-6 md:p-8 shadow-sm">
              {isEditingSummary ? (
                <textarea
                  autoFocus
                  value={data.summary}
                  onChange={(e) => updateData({ ...data, summary: e.target.value })}
                  onBlur={() => setIsEditingSummary(false)}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-800 dark:text-slate-200 min-h-[300px] resize-none font-mono"
                  placeholder={t('enterStrategicAnalysis')}
                />
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold text-slate-700 dark:text-slate-350">
                  <ReactMarkdown>{data.summary}</ReactMarkdown>
                </div>
              )}
            </div>
          </section>

          {/* Key Decisions Checklist */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Gavel className="text-slate-500 dark:text-slate-400 w-4 h-4 shrink-0" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('keyDecisions')}</h2>
              </div>
              <button 
                onClick={() => updateData({ ...data, keyDecisions: [...data.keyDecisions, ''] })}
                className="p-1.5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors"
                title={t('addDecision')}
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {data.keyDecisions.map((decision, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={i}
                  className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-start gap-4 transition-all hover:border-slate-300 dark:hover:border-white/10"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                  <textarea
                    value={decision}
                    onChange={(e) => {
                      const newDecisions = [...data.keyDecisions];
                      newDecisions[i] = e.target.value;
                      updateData({ ...data, keyDecisions: newDecisions });
                    }}
                    placeholder={t('enterDecisionDetails')}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <button 
                    onClick={() => {
                      const newDecisions = data.keyDecisions.filter((_, idx) => idx !== i);
                      updateData({ ...data, keyDecisions: newDecisions });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0 mt-0.5"
                    title={t('delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
              {data.keyDecisions.length === 0 && (
                <div className="py-12 bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-40">
                  <Gavel size={24} className="mb-2 text-slate-400" />
                  <p className="text-xs font-bold uppercase tracking-wider">{t('noDecisionsRecorded')}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Space: Highlights, Actions & Exports */}
        <aside className="lg:col-span-4 space-y-6 h-fit lg:sticky lg:top-8">
          
          {/* Action Panel - Exports & Backups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('exportManagement')}</span>
              <div className="flex gap-1.5">
                <button 
                  onClick={undo} 
                  disabled={!canUndo} 
                  className="p-1.5 border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo size={14} />
                </button>
                <button 
                  onClick={redo} 
                  disabled={!canRedo} 
                  className="p-1.5 border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo size={14} />
                </button>
              </div>
            </div>

            <button 
              onClick={downloadPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold tracking-wide shadow-sm transition-all"
            >
              <Download size={15} /> {t('exportOfficialPdf')}
            </button>

            <button 
              onClick={() => copyToClipboard('markdown')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold transition-all"
            >
              <Hash size={15} /> {t('copyMarkdown')}
            </button>

            {/* Micro-Dropdown or Secondary Actions list */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
              <button 
                onClick={downloadMarkdown}
                className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center rounded-lg transition-colors"
                title={t('downloadMdFile')}
              >
                File (.md)
              </button>
              <button 
                onClick={downloadJSON}
                className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center rounded-lg transition-colors"
                title={t('downloadJsonFile')}
              >
                File (.json)
              </button>
            </div>
          </div>

          {/* Highlights Section */}
          <section className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('keyHighlights')}</h3>
              <button 
                onClick={() => updateData({ ...data, highlights: [...data.highlights, ''] })}
                className="w-7 h-7 border border-slate-200 dark:border-white/5 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="space-y-3 pt-1">
              {data.highlights.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 px-4 py-3 rounded-xl flex items-start gap-2.5 transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-2 shrink-0" />
                  <textarea
                    value={item}
                    onChange={(e) => {
                      const newHighlights = [...data.highlights];
                      newHighlights[i] = e.target.value;
                      updateData({ ...data, highlights: newHighlights });
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed resize-none"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <button 
                    onClick={() => {
                      const newHighlights = data.highlights.filter((_, idx) => idx !== i);
                      updateData({ ...data, highlights: newHighlights });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Immediate Next Actions Checklist */}
          <section className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('nextActions')}</h3>
              <button 
                onClick={() => updateData({ ...data, nextActions: [...data.nextActions, ''] })}
                className="w-7 h-7 border border-slate-200 dark:border-white/5 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="space-y-3 pt-1">
              {data.nextActions.map((action, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 p-3 rounded-xl flex items-start gap-3 transition-all"
                >
                  <span className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-white/5 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <textarea
                    value={action}
                    onChange={(e) => {
                      const newActions = [...data.nextActions];
                      newActions[i] = e.target.value;
                      updateData({ ...data, nextActions: newActions });
                    }}
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-normal resize-none"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <button 
                    onClick={() => {
                      const newActions = data.nextActions.filter((_, idx) => idx !== i);
                      updateData({ ...data, nextActions: newActions });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Transcript Log Section (Fully integrated into Light/Dark flow) */}
      <section className="space-y-6 mt-8 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-slate-400 dark:text-slate-550 w-4 h-4 shrink-0" />
              <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">{t('fullTranscript')}</h2>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('speakerDiarizationDesc')}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-white/5">
              <input 
                type="checkbox" 
                id="includeTranscriptBottom"
                checked={includeTranscript}
                onChange={(e) => setIncludeTranscript(e.target.checked)}
                className="w-4 h-4 rounded border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-slate-500 bg-transparent cursor-pointer"
              />
              <label htmlFor="includeTranscriptBottom" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer uppercase tracking-wider">{t('includeInExport')}</label>
            </div>
            <button 
              onClick={downloadOnlyTranscript}
              className="px-4 py-2 border border-slate-200/80 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-950 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
            >
              {t('exportTranscriptTxt')}
            </button>
          </div>
        </div>

        {/* Scrollable Container with minimal, smooth lines */}
        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar-white">
          {data.transcript.map((entry, i) => {
            const colorIndex = entry.speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2;
            return (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="group flex gap-4 p-4 rounded-xl hover:bg-slate-100/40 dark:hover:bg-slate-850/40 transition-all"
              >
                {/* Speaker Initial Block */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-sm",
                    colorIndex === 0 
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200" 
                      : "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  )}>
                    {entry.speaker.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Speaker Content Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {editingSpeakerIndex === i ? (
                      <input
                        autoFocus
                        value={editingSpeakerValue}
                        onChange={(e) => setEditingSpeakerValue(e.target.value)}
                        onBlur={() => handleSpeakerSave(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSpeakerSave(i);
                          if (e.key === 'Escape') setEditingSpeakerIndex(null);
                        }}
                        className="bg-transparent border-b border-slate-400 dark:border-slate-600 text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none py-0 px-1"
                      />
                    ) : (
                      <span 
                        onClick={() => handleSpeakerClick(i, entry.speaker)}
                        className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-amber-500 transition-colors"
                        title={t('clickToRenameSpeaker')}
                      >
                        {entry.speaker}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                      [{entry.timestamp}]
                    </span>
                  </div>
                  <textarea
                    value={entry.text}
                    onChange={(e) => {
                      const newTranscript = [...data.transcript];
                      newTranscript[i] = { ...entry, text: e.target.value };
                      updateData({ ...data, transcript: newTranscript });
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal resize-none"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
};
