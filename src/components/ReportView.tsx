import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, ListFilter, MessageSquare, Download, FileJson, Plus, Trash2, Copy, Check, Undo, Redo, Gavel, Hash } from 'lucide-react';
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
    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    link.download = `meeting-report${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.md`;
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
      <div className="space-y-6">
        <div className="space-y-2">
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
              className="text-3xl md:text-4xl font-display font-bold text-app-fg bg-transparent border-b-2 border-app-accent focus:outline-none w-full py-2"
            />
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="text-3xl md:text-4xl font-display font-bold text-app-fg cursor-pointer hover:text-app-accent transition-colors leading-tight break-words"
            >
              {data.title}
            </h1>
          )}
          <p className="text-sm text-black/70 font-normal leading-relaxed max-w-4xl line-clamp-2 border-l-2 border-app-green/30 pl-4 mt-4">
            {data.summary.replace(/[#*`]/g, '').trim()}
          </p>
        </div>

        {/* Meeting Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 bg-app-card rounded-2xl border border-app-border shadow-sm">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-app-green" />
              Client Name
            </label>
            <input
              type="text"
              value={data.clientName}
              onChange={(e) => updateData({ ...data, clientName: e.target.value })}
              placeholder="Enter client name..."
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-base font-medium text-black placeholder:text-app-brown/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-app-green" />
              Meeting Date & Time
            </label>
            <input
              type="datetime-local"
              value={data.meetingDate}
              onChange={(e) => updateData({ ...data, meetingDate: e.target.value })}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-base font-medium text-black [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Summary Section - Moved up */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-app-green/10 flex items-center justify-center text-app-green">
              <FileText size={20} />
            </div>
            <h2 className="text-2xl font-bold text-app-fg">Executive Summary</h2>
          </div>
          <button 
            onClick={() => setIsEditingSummary(!isEditingSummary)}
            className="text-[10px] font-bold uppercase tracking-widest text-app-green hover:opacity-80 transition-opacity bg-app-green/5 px-3 py-1.5 rounded-full border border-app-green/10"
          >
            {isEditingSummary ? 'Preview Markdown' : 'Edit Source'}
          </button>
        </div>
        
        <div className="bg-app-card rounded-3xl border border-app-border p-8 shadow-md relative group">
          {isEditingSummary ? (
            <textarea
              autoFocus
              value={data.summary}
              onChange={(e) => updateData({ ...data, summary: e.target.value })}
              onBlur={() => setIsEditingSummary(false)}
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-base md:text-lg leading-relaxed text-app-fg min-h-[250px] resize-none font-mono"
              placeholder="Enter executive summary..."
            />
          ) : (
            <div 
              onClick={() => setIsEditingSummary(true)}
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-app-green prose-strong:text-app-dark-green text-black cursor-text"
            >
              <ReactMarkdown>{data.summary}</ReactMarkdown>
            </div>
          )}
        </div>
      </section>

      {/* Action Bar - Export Options */}
      <div className="flex flex-nowrap items-center gap-2 p-2 bg-app-card/30 backdrop-blur-md rounded-2xl border border-app-border/50 sticky top-4 z-10 shadow-lg overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 px-1.5 py-1 bg-app-bg rounded-xl border border-app-border shadow-inner shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-2 text-app-brown/40 hover:text-app-fg disabled:text-app-brown/10 disabled:cursor-not-allowed transition-colors"
          >
            <Undo size={18} />
          </button>
          <div className="w-px h-5 bg-app-border mx-1" />
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-2 text-app-brown/40 hover:text-app-fg disabled:text-app-brown/10 disabled:cursor-not-allowed transition-colors"
          >
            <Redo size={18} />
          </button>
        </div>

        <div className="h-8 w-px bg-app-border mx-1 hidden md:block" />

        <div className="flex items-center gap-1.5 px-3 py-2 bg-app-bg rounded-xl border border-app-border shadow-inner shrink-0">
          <input 
            type="checkbox" 
            id="includeTranscript"
            checked={includeTranscript}
            onChange={(e) => setIncludeTranscript(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-app-border text-app-green focus:ring-app-green bg-app-bg"
          />
          <label htmlFor="includeTranscript" className="text-[9px] font-bold text-app-brown/60 cursor-pointer select-none uppercase tracking-wider whitespace-nowrap">
            Include Transcript
          </label>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button 
            onClick={() => copyToClipboard('text')}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-brown/60 hover:text-app-fg hover:bg-app-bg rounded-xl transition-all border border-app-border shadow-sm whitespace-nowrap"
          >
            {copied ? <Check size={12} className="text-app-green" /> : <Copy size={12} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button 
            onClick={() => copyToClipboard('markdown')}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-green hover:text-white hover:bg-app-green rounded-xl transition-all border border-app-green/20 shadow-sm whitespace-nowrap"
          >
            <Hash size={12} />
            <span>Markdown</span>
          </button>

          <button 
            onClick={downloadMarkdown}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-green hover:bg-app-green/10 rounded-xl transition-all border border-app-green/20 shadow-sm whitespace-nowrap"
          >
            <Download size={12} />
            <span>MD</span>
          </button>

          <button 
            onClick={downloadJSON}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-gold hover:bg-app-gold/5 rounded-xl transition-all border border-app-gold/20 shadow-sm whitespace-nowrap"
          >
            <FileJson size={12} />
            <span>JSON</span>
          </button>

          <button 
            onClick={downloadPDF}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-dark-green hover:bg-app-dark-green/5 rounded-xl transition-all border border-app-dark-green/20 shadow-sm whitespace-nowrap"
          >
            <FileText size={12} />
            <span>PDF</span>
          </button>

          <button 
            onClick={downloadReport}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-green hover:bg-app-green/5 rounded-xl transition-all border border-app-green/20 shadow-sm whitespace-nowrap"
          >
            <Download size={12} />
            <span>TXT</span>
          </button>

          <button 
            onClick={onReset}
            className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-widest text-app-brown/40 hover:text-app-fg transition-colors whitespace-nowrap"
          >
            New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Highlights */}
        <section className="space-y-6">
          <div className="flex items-center justify-between text-black uppercase tracking-widest text-xs font-bold border-b border-app-border pb-2">
            <div className="flex items-center gap-2">
              <ListFilter size={16} className="text-app-green" />
              <span>Key Highlights</span>
            </div>
            <button 
              onClick={() => updateData({ ...data, highlights: [...data.highlights, ''] })}
              className="p-1.5 hover:bg-app-green/10 rounded-lg transition-colors text-app-green"
            >
              <Plus size={16} />
            </button>
          </div>
          <ul className="space-y-4">
            {data.highlights.map((item, i) => (
              <motion.li 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="flex gap-4 text-app-fg group/item bg-app-card/30 p-3 rounded-xl border border-transparent hover:border-app-border transition-all"
              >
                <span className="text-app-green font-bold mt-1.5">•</span>
                <textarea
                  value={item}
                  onChange={(e) => {
                    const newHighlights = [...data.highlights];
                    newHighlights[i] = e.target.value;
                    updateData({ ...data, highlights: newHighlights });
                  }}
                  className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed resize-none min-h-[24px]"
                  placeholder="Enter highlight..."
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
                <button 
                  onClick={() => updateData({ ...data, highlights: data.highlights.filter((_, index) => index !== i) })}
                  className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:text-rose-500 transition-all text-app-brown/30"
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* Key Decisions */}
        <section className="space-y-6">
          <div className="flex items-center justify-between text-black uppercase tracking-widest text-xs font-bold border-b border-app-border pb-2">
            <div className="flex items-center gap-2">
              <Gavel size={16} className="text-app-gold" />
              <span>Key Decisions</span>
            </div>
            <button 
              onClick={() => updateData({ ...data, keyDecisions: [...(data.keyDecisions || []), ''] })}
              className="p-1.5 hover:bg-app-gold/10 rounded-lg transition-colors text-app-gold"
            >
              <Plus size={16} />
            </button>
          </div>
          <ul className="space-y-4">
            {(data.keyDecisions || []).map((item, i) => (
              <motion.li 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="flex gap-4 items-start bg-app-gold/5 p-4 rounded-2xl border border-app-gold/10 group/item hover:bg-app-gold/10 transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-app-gold flex-shrink-0 flex items-center justify-center mt-0.5">
                  <Check size={12} className="text-white" />
                </div>
                <textarea
                  value={item}
                  onChange={(e) => {
                    const newDecisions = [...(data.keyDecisions || [])];
                    newDecisions[i] = e.target.value;
                    updateData({ ...data, keyDecisions: newDecisions });
                  }}
                  className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm text-app-fg font-medium leading-relaxed resize-none min-h-[24px]"
                  placeholder="Enter decision..."
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
                <button 
                  onClick={() => updateData({ ...data, keyDecisions: (data.keyDecisions || []).filter((_, index) => index !== i) })}
                  className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:text-rose-500 transition-all text-app-brown/30"
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>

        {/* Next Actions */}
        <section className="space-y-6">
          <div className="flex items-center justify-between text-black uppercase tracking-widest text-xs font-bold border-b border-app-border pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-app-dark-green" />
              <span>Next Actions</span>
            </div>
            <button 
              onClick={() => updateData({ ...data, nextActions: [...data.nextActions, ''] })}
              className="p-1.5 hover:bg-app-dark-green/10 rounded-lg transition-colors text-app-dark-green"
            >
              <Plus size={16} />
            </button>
          </div>
          <ul className="space-y-4">
            {data.nextActions.map((item, i) => (
              <motion.li 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={i} 
                className="flex gap-4 items-start bg-app-dark-green/5 p-4 rounded-2xl border border-app-dark-green/10 group/item hover:bg-app-dark-green/10 transition-all"
              >
                <span className="text-app-dark-green font-bold text-sm mt-0.5">{i + 1}.</span>
                <textarea
                  value={item}
                  onChange={(e) => {
                    const newActions = [...data.nextActions];
                    newActions[i] = e.target.value;
                    updateData({ ...data, nextActions: newActions });
                  }}
                  className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm text-app-fg leading-relaxed resize-none min-h-[24px]"
                  placeholder="Enter action item..."
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
                <button 
                  onClick={() => updateData({ ...data, nextActions: data.nextActions.filter((_, index) => index !== i) })}
                  className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:text-rose-500 transition-all text-app-brown/30"
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>

      {/* Transcript */}
      <section className="space-y-6 pt-8 border-t border-app-border">
        <div className="flex items-center justify-between text-black uppercase tracking-widest text-[10px] font-bold">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} />
            <span>Full Transcript</span>
          </div>
          <button 
            onClick={() => {
              const text = data.transcript.map(t => `[${t.timestamp}] ${t.speaker.toUpperCase()}: ${t.text}`).join('\n\n');
              navigator.clipboard.writeText(text);
              setCopiedTranscript(true);
              setTimeout(() => setCopiedTranscript(false), 2000);
            }}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-app-card rounded-lg transition-all text-app-brown/60 hover:text-app-fg"
          >
            {copiedTranscript ? <Check size={12} className="text-app-green" /> : <Copy size={12} />}
            <span>{copiedTranscript ? 'Copied!' : 'Copy Transcript'}</span>
          </button>
        </div>
        <div className="space-y-5">
          {data.transcript.map((entry, i) => {
            // Simple color assignment based on speaker name using the organic palette
            const colors = [
              'bg-app-green/10 text-app-green border-app-green/20',
              'bg-app-gold/10 text-app-gold border-app-gold/20',
              'bg-app-dark-green/10 text-app-dark-green border-app-dark-green/20',
              'bg-app-brown/10 text-app-brown border-app-brown/20',
              'bg-app-light-gold/10 text-app-light-gold border-app-light-gold/20',
            ];
            const colorIndex = entry.speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
            const colorClass = colors[colorIndex];

            return (
              <div key={i} className="group">
                {/* Header: Speaker & Timestamp */}
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold ${colorClass}`}>
                    {entry.speaker.charAt(0).toUpperCase()}
                  </div>
                  
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
                      className="text-[10px] font-mono font-bold text-app-fg uppercase tracking-tight bg-app-card border border-app-green rounded px-1 py-0 focus:outline-none"
                    />
                  ) : (
                    <span 
                      onClick={() => handleSpeakerClick(i, entry.speaker)}
                      className="text-[10px] font-mono font-bold text-black uppercase tracking-tight group-hover:text-app-green transition-colors cursor-pointer hover:underline decoration-dotted underline-offset-2"
                      title="Click to rename speaker"
                    >
                      {entry.speaker}
                    </span>
                  )}
                  
                  <span className="text-[9px] font-mono text-app-brown/60">
                    • {entry.timestamp}
                  </span>
                </div>
                
                {/* Speech Text - Editable */}
                <textarea
                  value={entry.text}
                  onChange={(e) => {
                    const newTranscript = [...data.transcript];
                    newTranscript[i] = { ...entry, text: e.target.value };
                    updateData({ ...data, transcript: newTranscript });
                  }}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-black leading-snug font-normal pl-7 resize-none min-h-[20px]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
};
