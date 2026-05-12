import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, ListFilter, MessageSquare, Download, FileJson, Plus, Trash2, Copy, Check, Undo, Redo, Gavel, Hash, User, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { MeetingReport } from '../services/gemini';
import { jsPDF } from 'jspdf';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface ReportViewProps {
  report: MeetingReport;
  title?: string;
  onReset: () => void;
  onUpdate?: (updatedReport: MeetingReport) => void;
  onUpdateTitle?: (newTitle: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, title: initialTitle, onReset, onUpdate, onUpdateTitle }) => {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-4 md:p-8 space-y-10 pb-32"
    >
      {/* Header Section: Title & Metadata */}
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-app-accent/10 text-app-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-full ring-1 ring-app-accent/20">
                Session Analysis
              </span>
              <span className="text-[10px] font-mono text-app-fg/40 uppercase tracking-[0.2em]">
                {new Date(data.meetingDate).toLocaleDateString()}
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
                    updateData({ ...data, title: initialTitle || 'Meeting Intelligence Report' });
                    setIsEditingTitle(false);
                  }
                }}
                className="text-4xl md:text-5xl font-display font-black text-app-fg bg-transparent border-b-2 border-app-accent focus:outline-none w-full py-2 tracking-tight"
              />
            ) : (
              <h1 
                onClick={() => setIsEditingTitle(true)}
                className="text-4xl md:text-5xl font-display font-black text-app-fg cursor-pointer hover:text-app-accent transition-colors leading-[1.1] tracking-tight break-words"
              >
                {data.title}
              </h1>
            )}
          </div>
          
          <div className="flex gap-3 shrink-0">
            <button 
              onClick={downloadPDF}
              className="px-6 py-3 bg-app-dark-green text-app-light-gold rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Export PDF
            </button>
            <button 
              onClick={onReset}
              className="p-3 glass rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Discard Report"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Global Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 glass rounded-[2.5rem] shadow-sm inner-glow">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-app-accent" />
              Identidade do Cliente
            </label>
            <input
              type="text"
              value={data.clientName}
              onChange={(e) => updateData({ ...data, clientName: e.target.value })}
              placeholder="Enterprise Global Ltda."
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-lg font-black text-app-fg placeholder:text-app-fg/10 tracking-tight"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-app-accent" />
              Cronologia da Sessão
            </label>
            <input
              type="datetime-local"
              value={data.meetingDate}
              onChange={(e) => updateData({ ...data, meetingDate: e.target.value })}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-lg font-black text-app-fg [color-scheme:light] dark:[color-scheme:dark] tracking-tight"
            />
          </div>
        </div>
        {/* Intelligence Grid Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-5 rounded-3xl border-transparent hover:border-app-accent/20 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <User size={16} className="text-app-fg/30" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-2xl font-display font-black text-app-fg">{data.transcript.reduce((acc, t) => acc.add(t.speaker), new Set()).size}</p>
            <p className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.2em] mt-1">Intervenientes</p>
          </div>
          <div className="glass p-5 rounded-3xl border-transparent hover:border-app-accent/20 transition-all overflow-hidden relative">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare size={16} className="text-app-fg/30" />
              <div className="flex gap-[2px] items-end h-3">
                {[4, 7, 5, 9, 3, 6, 8].map((h, i) => (
                  <div key={i} className="w-1 bg-app-accent/30 rounded-full" style={{ height: `${h * 10}%` }} />
                ))}
              </div>
            </div>
            <p className="text-2xl font-display font-black text-app-fg">{data.transcript.length}</p>
            <p className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.2em] mt-1">Total Interações</p>
          </div>
          <div className="glass p-5 rounded-3xl border-transparent hover:border-app-accent/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Gavel size={16} className="text-app-fg/30" />
              <span className="text-[10px] font-black text-app-accent uppercase tracking-widest">Enforced</span>
            </div>
            <p className="text-2xl font-display font-black text-app-fg">{data.keyDecisions.length}</p>
            <p className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.2em] mt-1">Decisões Críticas</p>
          </div>
          <div className="glass p-5 rounded-3xl border-transparent hover:border-app-accent/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 size={16} className="text-app-fg/30" />
              <div className="flex -space-x-2 group-hover:-space-x-1 transition-all">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full glass border-app-accent/20 flex items-center justify-center text-[8px] font-black">
                    {i}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-2xl font-display font-black text-app-fg">{data.nextActions.length}</p>
            <p className="text-[10px] font-black text-app-fg/40 uppercase tracking-[0.2em] mt-1">Ações Pendentes</p>
          </div>
        </div>
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Deep Analysis Column */}
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-app-dark-green text-app-accent flex items-center justify-center shadow-lg">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black text-app-fg tracking-tight leading-none">Executive Insight</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-fg/40 mt-1">Drafted by Gemini Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditingSummary(!isEditingSummary)}
                className="text-[10px] font-black uppercase tracking-widest text-app-accent hover:bg-app-accent/10 border border-app-accent/20 px-5 py-2.5 rounded-2xl transition-all glass shadow-sm"
              >
                {isEditingSummary ? 'Finalize Edit' : 'Modify Core Analysis'}
              </button>
            </div>
            
            <div className="glass rounded-[3rem] p-10 shadow-2xl relative inner-glow">
              <div className="absolute top-8 right-8 text-app-accent opacity-10">
                <Sparkles size={120} />
              </div>
              {isEditingSummary ? (
                <textarea
                  autoFocus
                  value={data.summary}
                  onChange={(e) => updateData({ ...data, summary: e.target.value })}
                  onBlur={() => setIsEditingSummary(false)}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-lg leading-relaxed text-app-fg min-h-[350px] resize-none font-mono"
                  placeholder="Enter strategic analysis..."
                />
              ) : (
                <div 
                  onClick={() => setIsEditingSummary(true)}
                  className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight prose-a:text-app-accent prose-strong:text-app-fg text-app-fg/80 cursor-text leading-[1.8]"
                >
                  <ReactMarkdown>{data.summary}</ReactMarkdown>
                </div>
              )}
            </div>
          </section>

          {/* Key Decisions - Sophisticated Layout */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 px-4">
              <div className="w-12 h-12 rounded-2xl glass text-emerald-500 flex items-center justify-center shadow-lg border-emerald-500/20">
                <Gavel size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-display font-black text-app-fg tracking-tight leading-none">Key Decisions</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-fg/40 mt-1">Binding Outcomes & Directives</p>
              </div>
              <button 
                onClick={() => updateData({ ...data, keyDecisions: [...data.keyDecisions, ''] })}
                className="ml-auto w-10 h-10 glass rounded-full flex items-center justify-center text-app-accent hover:rotate-90 transition-transform"
              >
                <Plus size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.keyDecisions.map((decision, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i}
                  className="glass p-6 rounded-[2rem] border-emerald-500/10 hover:border-emerald-500/30 transition-all group flex flex-col justify-between min-h-[140px]"
                >
                  <textarea
                    value={decision}
                    onChange={(e) => {
                      const newDecisions = [...data.keyDecisions];
                      newDecisions[i] = e.target.value;
                      updateData({ ...data, keyDecisions: newDecisions });
                    }}
                    placeholder="Describe the decision reached..."
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-app-fg/90 resize-none leading-snug"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">Ratified</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newDecisions = data.keyDecisions.filter((_, idx) => idx !== i);
                        updateData({ ...data, keyDecisions: newDecisions });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-app-fg/20 hover:text-rose-500 transition-all scale-75 group-hover:scale-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
              {data.keyDecisions.length === 0 && (
                <div className="md:col-span-2 py-12 glass rounded-[2.5rem] flex flex-col items-center justify-center text-center opacity-30 border-dashed border-2">
                  <Gavel size={32} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">Nenhuma decisão registada</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Data-Rich Cards */}
        <aside className="lg:col-span-4 space-y-8 h-fit lg:sticky lg:top-8">
          {/* Action Bar - Floating Export */}
          <div className="glass p-4 rounded-3xl shadow-xl space-y-3">
             <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-app-fg/40">Data Management</span>
                <div className="flex gap-1">
                   <button onClick={undo} disabled={!canUndo} className="p-1.5 glass rounded-lg disabled:opacity-20"><Undo size={14} /></button>
                   <button onClick={redo} disabled={!canRedo} className="p-1.5 glass rounded-lg disabled:opacity-20"><Redo size={14} /></button>
                </div>
             </div>
             <button 
              onClick={() => copyToClipboard('markdown')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 glass rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-app-accent hover:bg-app-accent hover:text-white transition-all shadow-sm"
             >
               <Hash size={16} /> Copy Markdown
             </button>
             <button 
              onClick={downloadPDF}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-app-dark-green text-app-light-gold rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
               <Download size={16} /> Generate Report
             </button>
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-app-fg/40">Strategic Highlights</h3>
              <button 
                onClick={() => updateData({ ...data, highlights: [...data.highlights, ''] })}
                className="w-8 h-8 glass rounded-full flex items-center justify-center text-app-accent hover:bg-app-accent/10 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {data.highlights.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass p-6 rounded-[2rem] border-transparent hover:border-app-accent/10 transition-all group relative"
                >
                  <div className="absolute top-6 left-6 w-2 h-2 rounded-full bg-app-accent/40 group-hover:bg-app-accent transition-colors" />
                  <textarea
                    value={item}
                    onChange={(e) => {
                      const newHighlights = [...data.highlights];
                      newHighlights[i] = e.target.value;
                      updateData({ ...data, highlights: newHighlights });
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-app-fg leading-relaxed pl-6 resize-none"
                    rows={2}
                  />
                  <button 
                    onClick={() => {
                      const newHighlights = data.highlights.filter((_, idx) => idx !== i);
                      updateData({ ...data, highlights: newHighlights });
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-rose-500 scale-75 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-6 pt-4">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-app-fg/40">Immediate Next Actions</h3>
              <button 
                onClick={() => updateData({ ...data, nextActions: [...data.nextActions, ''] })}
                className="w-8 h-8 glass rounded-full flex items-center justify-center text-app-accent hover:bg-app-accent/10 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {data.nextActions.map((action, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass p-5 rounded-2xl flex items-start gap-4 hover:shadow-lg transition-all group"
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center border border-app-accent/30 text-app-accent mt-0.5 shrink-0">
                    <span className="text-[9px] font-black">{i + 1}</span>
                  </div>
                  <textarea
                    value={action}
                    onChange={(e) => {
                      const newActions = [...data.nextActions];
                      newActions[i] = e.target.value;
                      updateData({ ...data, nextActions: newActions });
                    }}
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-app-fg/80 leading-snug resize-none"
                    rows={2}
                  />
                  <button 
                    onClick={() => {
                      const newActions = data.nextActions.filter((_, idx) => idx !== i);
                      updateData({ ...data, nextActions: newActions });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-app-fg/20 hover:text-rose-500 transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Transcript Section */}
      <section className="space-y-8 mt-12 bg-app-dark-green rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden text-app-light-gold">
        <div className="absolute top-0 right-0 w-96 h-96 bg-app-accent/5 blur-[120px] rounded-full -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-app-accent/5 blur-[80px] rounded-full -ml-32 -mb-32" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 border-b border-white/10 pb-8 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl glass text-app-accent flex items-center justify-center shadow-lg border-white/5">
                <MessageSquare size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-display font-black text-white tracking-tight leading-none">Intelligence Logs</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-2">Diarized Transcript & Voice Analysis</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="glass px-5 py-3 rounded-2xl flex items-center gap-3 border-white/5">
                <input 
                  type="checkbox" 
                  id="includeTranscriptBottom"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 text-app-accent focus:ring-app-accent bg-transparent"
                />
                <label htmlFor="includeTranscriptBottom" className="text-[10px] font-black text-white/80 cursor-pointer uppercase tracking-widest">Expose in Export</label>
             </div>
             <button 
              onClick={downloadOnlyTranscript}
              className="px-6 py-3.5 glass hover:bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border-white/10"
             >
               Export RAW (.txt)
             </button>
          </div>
        </div>

        <div className="space-y-4 relative z-10 max-h-[800px] overflow-y-auto custom-scrollbar-white pr-4">
          {data.transcript.map((entry, i) => {
             const colorIndex = entry.speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2;
             return (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex gap-6 p-6 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
              >
                <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-inner",
                     colorIndex === 0 ? "bg-app-accent text-app-dark-green" : "bg-white/10 text-white"
                   )}>
                      {entry.speaker.charAt(0).toUpperCase()}
                   </div>
                   <div className="w-px flex-1 bg-white/5" />
                </div>

                <div className="flex-1 space-y-2">
                   <div className="flex items-center gap-3">
                      {editingSpeakerIndex === i ? (
                        <input
                          autoFocus
                          value={editingSpeakerValue}
                          onChange={(e) => setEditingSpeakerValue(e.target.value)}
                          onBlur={() => handleSpeakerSave(i)}
                          className="bg-transparent border-b border-app-accent text-[10px] font-black text-white uppercase tracking-widest focus:outline-none"
                        />
                      ) : (
                        <span 
                          onClick={() => handleSpeakerClick(i, entry.speaker)}
                          className="text-[10px] font-black text-app-accent uppercase tracking-[0.3em] cursor-pointer hover:underline"
                        >
                          {entry.speaker}
                        </span>
                      )}
                      <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
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
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-white/70 leading-relaxed font-normal resize-none min-h-[20px]"
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
