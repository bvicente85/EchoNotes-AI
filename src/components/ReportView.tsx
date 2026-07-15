import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, CheckCircle2, ListFilter, MessageSquare, Download, FileJson, Plus, Trash2, Copy, Check, Undo, Redo, Gavel, Hash, User, Sparkles, Play, Pause, Volume2, VolumeX, Clock, FastForward, RotateCcw, Mail, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { MeetingReport } from '../services/gemini';
import { jsPDF } from 'jspdf';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { getAudio } from '../services/audioStorage';

interface ReportViewProps {
  report: MeetingReport;
  title?: string;
  meetingId?: string;
  onReset: () => void;
  onUpdate?: (updatedReport: MeetingReport) => void;
  onUpdateTitle?: (newTitle: string) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ report, title: initialTitle, meetingId, onReset, onUpdate, onUpdateTitle }) => {
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
    title: initialTitle || 'Meeting Intelligence Report',
    isQuickDraft: report.isQuickDraft || false,
    quickDraft: report.quickDraft || {
      formattedNotes: '',
      taskList: [],
      emailDraft: ''
    }
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const isEditingTitleRef = useRef(isEditingTitle);
  const currentTitleRef = useRef(data.title);

  useEffect(() => {
    isEditingTitleRef.current = isEditingTitle;
    currentTitleRef.current = data.title;
  }, [isEditingTitle, data.title]);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState<number | null>(null);
  const [editingSpeakerValue, setEditingSpeakerValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedType, setCopiedType] = useState<'markdown' | 'text' | 'email' | 'crm' | 'scratchpad' | 'tasks' | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(true);

  // Quick Draft State
  const [activeDraftTab, setActiveDraftTab] = useState<'scratchpad' | 'tasks' | 'email'>('scratchpad');
  const [isEditingDraftNotes, setIsEditingDraftNotes] = useState(false);
  const [isEditingDraftEmail, setIsEditingDraftEmail] = useState(false);

  const copyQuickDraftContent = async (type: 'scratchpad' | 'tasks' | 'email') => {
    try {
      let content = '';
      if (type === 'scratchpad') {
        content = data.quickDraft?.formattedNotes || '';
      } else if (type === 'tasks') {
        content = (data.quickDraft?.taskList || []).map(t => `- [ ] ${t}`).join('\n');
      } else if (type === 'email') {
        content = data.quickDraft?.emailDraft || '';
      }
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy quick draft content: ', err);
    }
  };

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    
    const loadAudioBlob = async () => {
      if (!meetingId) return;
      setAudioLoading(true);
      try {
        const blob = await getAudio(meetingId);
        if (blob && active) {
          url = URL.createObjectURL(blob);
          setAudioUrl(url);
          // Reset other states
          setIsPlaying(false);
          setCurrentTime(0);
        } else if (active) {
          setAudioUrl(null);
        }
      } catch (err) {
        console.error("Error loading local audio blob:", err);
      } finally {
        if (active) setAudioLoading(false);
      }
    };
    
    loadAudioBlob();
    
    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [meetingId]);

  const togglePlay = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error("Play failed:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioPlayerRef.current) {
      setCurrentTime(audioPlayerRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioPlayerRef.current) {
      setDuration(audioPlayerRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioPlayerRef.current && audioUrl) {
      const newTime = parseFloat(e.target.value);
      audioPlayerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = newVolume;
      audioPlayerRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (audioPlayerRef.current) {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      audioPlayerRef.current.muted = nextMute;
      if (!nextMute && volume === 0) {
        setVolume(0.5);
        audioPlayerRef.current.volume = 0.5;
      }
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = rate;
    }
  };

  const skipTime = (seconds: number) => {
    if (audioPlayerRef.current && audioUrl) {
      let targetTime = audioPlayerRef.current.currentTime + seconds;
      if (targetTime < 0) targetTime = 0;
      if (targetTime > duration) targetTime = duration;
      audioPlayerRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const parseTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      const [mins, secs] = parts;
      return (mins || 0) * 60 + (secs || 0);
    } else if (parts.length === 3) {
      const [hrs, mins, secs] = parts;
      return (hrs || 0) * 3600 + (mins || 0) * 60 + (secs || 0);
    }
    return 0;
  };

  const handleJumpToTimestamp = (timestampStr: string) => {
    if (!audioPlayerRef.current || !audioUrl) return;
    const seconds = parseTimestampToSeconds(timestampStr);
    audioPlayerRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    audioPlayerRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(err => console.error("Could not play on jump:", err));
  };

  const formatAudioTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    reset({
      summary: report.summary,
      highlights: report.highlights,
      keyDecisions: report.keyDecisions || [],
      nextActions: report.nextActions,
      transcript: report.transcript,
      clientName: report.clientName || '',
      meetingDate: report.meetingDate || new Date().toISOString().slice(0, 16),
      title: isEditingTitleRef.current ? currentTitleRef.current : (initialTitle || 'Meeting Intelligence Report'),
      isQuickDraft: report.isQuickDraft || false,
      quickDraft: report.quickDraft || {
        formattedNotes: '',
        taskList: [],
        emailDraft: ''
      }
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

  // Title update is handled on blur or enter keypress to prevent focus issues during typing.

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

    if (data.isQuickDraft && data.quickDraft) {
      text += `CLEAN SCRATCHPAD\n`;
      text += `----------------\n`;
      text += `${data.quickDraft.formattedNotes}\n\n`;

      text += `TASK CHECKLIST\n`;
      text += `--------------\n`;
      text += `${(data.quickDraft.taskList || []).map(t => `[ ] ${t}`).join('\n')}\n\n`;

      text += `EMAIL DRAFT\n`;
      text += `-----------\n`;
      text += `${data.quickDraft.emailDraft}\n`;
    } else {
      text += `EXECUTIVE SUMMARY\n`;
      text += `-----------------\n`;
      text += `${data.summary}\n\n`;

      text += `KEY HIGHLIGHTS\n`;
      text += `--------------\n`;
      text += `${data.highlights.map((h) => `• ${h}`).join('\n')}\n\n`;

      text += `KEY DECISIONS\n`;
      text += `-------------\n`;
      text += `${data.keyDecisions.map((d) => `✓ ${d}`).join('\n')}\n\n`;

      text += `NEXT ACTIONS\n`;
      text += `------------\n`;
      text += `${data.nextActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n`;
    }

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
    
    if (data.isQuickDraft && data.quickDraft) {
      md += `## Clean Scratchpad\n${data.quickDraft.formattedNotes}\n\n`;
      md += `## Task Checklist\n`;
      (data.quickDraft.taskList || []).forEach(t => {
        md += `* [ ] ${t}\n`;
      });
      md += `\n`;
      md += `## Email Draft\n\`\`\`\n${data.quickDraft.emailDraft}\n\`\`\`\n\n`;
    } else {
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
    }

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

  const getEmailFormat = () => {
    const formattedDate = new Date(data.meetingDate).toLocaleString(language === 'portuguese' ? 'pt-PT' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    
    const clientStr = data.clientName ? ` - ${data.clientName}` : '';
    
    if (language === 'portuguese') {
      return `Assunto: Resumo de Reunião: ${data.title}${clientStr} (${formattedDate})

Olá a todos,

Espero que estejam bem.

Aqui está o resumo executivo, decisões tomadas e os próximos passos definidos na nossa reunião realizada em ${formattedDate}:

### 📋 Resumo Executivo
${data.summary}

### ✨ Destaques Principais
${data.highlights.map(h => `• ${h}`).join('\n')}

${data.keyDecisions.length > 0 ? `### ⚖️ Decisões Chave\n${data.keyDecisions.map(d => `• ${d}`).join('\n')}\n` : ''}
### 🚀 Próximos Passos
${data.nextActions.map((a, i) => `${i + 1}. [ ] ${a}`).join('\n')}

Se tiverem alguma dúvida ou sugestão de alteração, por favor avisem.

Melhores cumprimentos,
[A equipa]`;
    } else {
      return `Subject: Meeting Summary: ${data.title}${clientStr} (${formattedDate})

Hi everyone,

Hope you're doing well.

Here is a quick summary, key decisions, and next steps from our meeting held on ${formattedDate}:

### 📋 Executive Summary
${data.summary}

### ✨ Key Highlights
${data.highlights.map(h => `• ${h}`).join('\n')}

${data.keyDecisions.length > 0 ? `### ⚖️ Key Decisions\n${data.keyDecisions.map(d => `• ${d}`).join('\n')}\n` : ''}
### 🚀 Next Actions
${data.nextActions.map((a, i) => `${i + 1}. [ ] ${a}`).join('\n')}

Please let me know if you have any questions or corrections.

Best regards,
[The team]`;
    }
  };

  const getCrmFormat = () => {
    const formattedDate = new Date(data.meetingDate).toLocaleString(language === 'portuguese' ? 'pt-PT' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    
    const clientStr = data.clientName ? data.clientName : 'N/A';
    
    return `[MEETING LOG]
Client: ${clientStr}
Meeting: ${data.title}
Date: ${formattedDate}

----------------------------------------
SUMMARY:
${data.summary}

HIGHLIGHTS:
${data.highlights.map(h => `- ${h}`).join('\n')}

${data.keyDecisions.length > 0 ? `DECISIONS:\n${data.keyDecisions.map(d => `- ${d}`).join('\n')}\n` : ''}
ACTION ITEMS:
${data.nextActions.map((a, i) => `[ ] ${a}`).join('\n')}
----------------------------------------`;
  };

  const copyTemplate = async (type: 'email' | 'crm') => {
    try {
      const content = type === 'email' ? getEmailFormat() : getCrmFormat();
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy template: ', err);
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

    if (data.isQuickDraft && data.quickDraft) {
      // Scratchpad
      addWrappedText('CLEAN SCRATCHPAD', 12, true, [100, 100, 100]);
      addWrappedText(data.quickDraft.formattedNotes || '', 11, false, [20, 20, 20]);
      yPos += 5;

      // Tasks
      addWrappedText('TASK CHECKLIST', 12, true, [100, 100, 100]);
      (data.quickDraft.taskList || []).forEach((t, idx) => {
        addWrappedText(`[ ] ${t}`, 10, false, [40, 40, 40]);
      });
      yPos += 5;

      // Email
      addWrappedText('EMAIL DRAFT', 12, true, [100, 100, 100]);
      addWrappedText(data.quickDraft.emailDraft || '', 11, false, [20, 20, 20]);
      yPos += 10;
    } else {
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
    }

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

  const downloadWord = () => {
    const title = data.title;
    const client = data.clientName ? `<p><strong>Client / Cliente:</strong> ${data.clientName}</p>` : '';
    const date = `<p><strong>Date / Data:</strong> ${new Date(data.meetingDate).toLocaleString(language === 'portuguese' ? 'pt-PT' : 'en-US')}</p>`;
    
    let contentHtml = '';
    if (data.isQuickDraft && data.quickDraft) {
      contentHtml = `
        <h2>${language === 'portuguese' ? 'Bloco de Notas Limpo' : 'Clean Scratchpad'}</h2>
        <p>${(data.quickDraft.formattedNotes || '').replace(/\n/g, '<br>')}</p>
        <h2>${language === 'portuguese' ? 'Lista de Tarefas' : 'Task Checklist'}</h2>
        <ul>
          ${(data.quickDraft.taskList || []).map(t => `<li>[ ] ${t}</li>`).join('')}
        </ul>
        <h2>${language === 'portuguese' ? 'Rascunho de E-mail' : 'Email Draft'}</h2>
        <p>${(data.quickDraft.emailDraft || '').replace(/\n/g, '<br>')}</p>
      `;
    } else {
      contentHtml = `
        <h2>${t('executiveSummary')}</h2>
        <p>${(data.summary || '').replace(/\n/g, '<br>')}</p>
        <h2>${t('keyHighlights')}</h2>
        <ul>
          ${data.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        <h2>${t('keyDecisions')}</h2>
        <ul>
          ${data.keyDecisions.map(d => `<li>${d}</li>`).join('')}
        </ul>
        <h2>${t('nextActions')}</h2>
        <ol>
          ${data.nextActions.map(a => `<li>${a}</li>`).join('')}
        </ol>
      `;
    }

    if (includeTranscript && data.transcript && data.transcript.length > 0) {
      contentHtml += `
        <h2>${t('fullTranscript')}</h2>
        ${data.transcript.map(t => `<p><strong>[${t.timestamp}] ${t.speaker.toUpperCase()}:</strong> ${t.text}</p>`).join('')}
      `;
    }

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${title}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
          h1 { color: #1e293b; font-size: 24px; border-bottom: 2px solid #6B7A8F; padding-bottom: 5px; }
          h2 { color: #6B7A8F; font-size: 18px; margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
          p, li { font-size: 11pt; color: #334155; }
          ul, ol { margin-left: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${client}
        ${date}
        <hr/>
        ${contentHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const clientSuffix = data.clientName ? `-${data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
    link.download = `meeting-report${clientSuffix}-${new Date(data.meetingDate).toISOString().split('T')[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      className="px-6 sm:px-8 py-8 space-y-8 pb-32 font-sans text-slate-800 dark:text-slate-200"
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
                key="report-view-title-input"
                autoFocus
                value={data.title}
                onChange={(e) => updateData({ ...data, title: e.target.value })}
                onBlur={() => {
                  setIsEditingTitle(false);
                  if (onUpdateTitle && data.title !== initialTitle) {
                    onUpdateTitle(data.title);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    if (onUpdateTitle && data.title !== initialTitle) {
                      onUpdateTitle(data.title);
                    }
                  }
                  if (e.key === 'Escape') {
                    updateData({ ...data, title: initialTitle || t('intelligenceReport') });
                    setIsEditingTitle(false);
                  }
                }}
                className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-slate-400 dark:border-slate-505 focus:outline-none w-full py-1 tracking-tight"
              />
            ) : (
              <h1 
                key="report-view-title-display"
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

        {/* Audio Player Card */}
        {meetingId && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-app-green" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {t('audioPlayerTitle')}
                </h3>
              </div>
              {audioUrl && (
                <div className="flex gap-1.5">
                  {[1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={cn(
                        "px-2 py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer",
                        playbackRate === rate
                          ? "bg-app-green border-app-green text-white"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850"
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {audioLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <div className="w-4 h-4 border-2 border-app-green border-t-transparent rounded-full animate-spin" />
                <span>{t('audioPlayerLoading')}</span>
              </div>
            ) : audioUrl ? (
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* Controls Left Block */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => skipTime(-10)}
                    className="p-2 border border-slate-200/80 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
                    title="-10s"
                  >
                    <RotateCcw size={14} />
                  </button>
                  
                  <button
                    onClick={togglePlay}
                    className="p-3 bg-app-green hover:opacity-90 text-white rounded-full transition-colors flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  <button
                    onClick={() => skipTime(10)}
                    className="p-2 border border-slate-200/80 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
                    title="+10s"
                  >
                    <FastForward size={14} />
                  </button>
                </div>

                {/* Slider / Timeline Center Block */}
                <div className="flex-1 w-full flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 min-w-[32px] text-right">
                    {formatAudioTime(currentTime)}
                  </span>
                  
                  <div className="flex-1 relative group py-2">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeekChange}
                      className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-app-green focus:outline-none"
                    />
                    <div 
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-app-green rounded-lg pointer-events-none"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 min-w-[32px]">
                    {formatAudioTime(duration)}
                  </span>
                </div>

                {/* Volume & Details Right Block */}
                <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-between md:justify-start">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleMute}
                      className="p-2 hover:bg-slate-105 text-slate-500 dark:text-slate-400 cursor-pointer"
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-slate-150 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-app-green"
                    />
                  </div>
                </div>

                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleAudioEnded}
                />
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">
                {t('audioPlayerNotFound')}
              </div>
            )}
          </div>
        )}

        {/* Custom, Clean Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.isQuickDraft ? (
            <>
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {language === 'portuguese' ? 'Palavras' : 'Words'}
                  </p>
                  <FileText size={14} className="text-slate-400 dark:text-slate-550" />
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {(data.quickDraft?.formattedNotes || '').split(/\s+/).filter(Boolean).length}
                </p>
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {language === 'portuguese' ? 'Caracteres' : 'Characters'}
                  </p>
                  <Hash size={14} className="text-slate-400 dark:text-slate-550" />
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {(data.quickDraft?.formattedNotes || '').length}
                </p>
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {language === 'portuguese' ? 'Tarefas' : 'Tasks'}
                  </p>
                  <CheckCircle2 size={14} className="text-slate-400 dark:text-slate-550" />
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                  {(data.quickDraft?.taskList || []).length}
                </p>
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {language === 'portuguese' ? 'Modo' : 'Mode'}
                  </p>
                  <Sparkles size={14} className="text-app-green" />
                </div>
                <p className="text-xs font-bold text-app-green truncate mt-1">
                  {language === 'portuguese' ? 'Nota de Voz Rápida' : 'Quick Voice Draft'}
                </p>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Core Content: Summary & Decisions OR Quick Voice Draft */}
        <div className="lg:col-span-8 space-y-8">
          {data.isQuickDraft ? (
            <section className="space-y-6">
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 dark:border-white/5 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDraftTab('scratchpad')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeDraftTab === 'scratchpad'
                      ? "border-app-accent dark:border-app-accent text-slate-900 dark:text-white"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <FileText size={14} />
                  {t('quickDraftDraft') || 'Rascunho'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDraftTab('tasks')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeDraftTab === 'tasks'
                      ? "border-app-accent dark:border-app-accent text-slate-900 dark:text-white"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <CheckCircle2 size={14} />
                  {t('quickDraftTasks') || 'Tarefas'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDraftTab('email')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                    activeDraftTab === 'email'
                      ? "border-app-accent dark:border-app-accent text-slate-900 dark:text-white"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  <Mail size={14} />
                  {t('quickDraftEmail') || 'Email'}
                </button>
              </div>

              {/* Tab Content Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
                {activeDraftTab === 'scratchpad' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {t('quickDraftDraft') || 'Rascunho Polido'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyQuickDraftContent('scratchpad')}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedType === 'scratchpad' ? (
                            <>
                              <Check size={12} className="text-app-green" />
                              {language === 'portuguese' ? 'Copiado!' : 'Copied!'}
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              {t('quickDraftCopy') || 'Copiar'}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditingDraftNotes(!isEditingDraftNotes)}
                          className="px-3 py-1.5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {isEditingDraftNotes ? t('save') : t('editSummaryWord')}
                        </button>
                      </div>
                    </div>

                    {isEditingDraftNotes ? (
                      <textarea
                        autoFocus
                        value={data.quickDraft?.formattedNotes || ''}
                        onChange={(e) => {
                          const qd = data.quickDraft || { formattedNotes: '', taskList: [], emailDraft: '' };
                          updateData({
                            ...data,
                            quickDraft: { ...qd, formattedNotes: e.target.value }
                          });
                        }}
                        onBlur={() => setIsEditingDraftNotes(false)}
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-800 dark:text-slate-200 min-h-[400px] resize-none font-mono focus:outline-none"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed text-slate-700 dark:text-slate-350">
                        <ReactMarkdown>{data.quickDraft?.formattedNotes || ''}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {activeDraftTab === 'tasks' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {t('quickDraftTasks') || 'Lista de Tarefas'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyQuickDraftContent('tasks')}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedType === 'tasks' ? (
                            <>
                              <Check size={12} className="text-app-green" />
                              {language === 'portuguese' ? 'Copiado!' : 'Copied!'}
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              {t('quickDraftCopy') || 'Copiar'}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const qd = data.quickDraft || { formattedNotes: '', taskList: [], emailDraft: '' };
                            updateData({
                              ...data,
                              quickDraft: { ...qd, taskList: [...(qd.taskList || []), ''] }
                            });
                          }}
                          className="p-1.5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(data.quickDraft?.taskList || []).map((task, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/10 border border-slate-100 dark:border-white/5 p-3.5 rounded-xl"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer accent-app-green"
                          />
                          <input
                            type="text"
                            value={task}
                            onChange={(e) => {
                              const qd = data.quickDraft || { formattedNotes: '', taskList: [], emailDraft: '' };
                              const newList = [...(qd.taskList || [])];
                              newList[i] = e.target.value;
                              updateData({
                                ...data,
                                quickDraft: { ...qd, taskList: newList }
                              });
                            }}
                            className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
                            placeholder="Nova tarefa..."
                          />
                          <button
                            onClick={() => {
                              const qd = data.quickDraft || { formattedNotes: '', taskList: [], emailDraft: '' };
                              const newList = (qd.taskList || []).filter((_, idx) => idx !== i);
                              updateData({
                                ...data,
                                quickDraft: { ...qd, taskList: newList }
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all scale-90 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </motion.div>
                      ))}

                      {(data.quickDraft?.taskList || []).length === 0 && (
                        <div className="py-12 border border-dashed border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-40">
                          <CheckCircle2 size={24} className="mb-2 text-slate-400" />
                          <p className="text-xs font-bold uppercase tracking-wider">
                            {language === 'portuguese' ? 'Nenhuma tarefa detetada' : 'No tasks detected'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeDraftTab === 'email' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {t('quickDraftEmail') || 'Email Gerado'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyQuickDraftContent('email')}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedType === 'email' ? (
                            <>
                              <Check size={12} className="text-app-green" />
                              {language === 'portuguese' ? 'Copiado!' : 'Copied!'}
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              {t('quickDraftCopy') || 'Copiar'}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setIsEditingDraftEmail(!isEditingDraftEmail)}
                          className="px-3 py-1.5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {isEditingDraftEmail ? t('save') : t('editSummaryWord')}
                        </button>
                      </div>
                    </div>

                    {isEditingDraftEmail ? (
                      <textarea
                        autoFocus
                        value={data.quickDraft?.emailDraft || ''}
                        onChange={(e) => {
                          const qd = data.quickDraft || { formattedNotes: '', taskList: [], emailDraft: '' };
                          updateData({
                            ...data,
                            quickDraft: { ...qd, emailDraft: e.target.value }
                          });
                        }}
                        onBlur={() => setIsEditingDraftEmail(false)}
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-800 dark:text-slate-200 min-h-[400px] resize-none font-mono focus:outline-none"
                      />
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 whitespace-pre-wrap font-sans">
                        {data.quickDraft?.emailDraft || ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* Executive Insight Box */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-500 w-4 h-4 shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('executiveSummary')}</h2>
                  </div>
                  <button 
                    onClick={() => setIsEditingSummary(!isEditingSummary)}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-lg transition-all bg-white dark:bg-slate-900 shadow-sm cursor-pointer"
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
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm leading-relaxed text-slate-800 dark:text-slate-200 min-h-[300px] resize-none font-mono focus:outline-none"
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
                    className="p-1.5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
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
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed focus:outline-none"
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0 mt-0.5 cursor-pointer"
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

              {/* Highlights Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-500 w-4 h-4 shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('keyHighlights')}</h2>
                  </div>
                  <button 
                    onClick={() => updateData({ ...data, highlights: [...data.highlights, ''] })}
                    className="p-1.5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Adicionar Destaque"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {data.highlights.map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-start gap-4 transition-all hover:border-slate-300 dark:hover:border-white/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                      <textarea
                        value={item}
                        onChange={(e) => {
                          const newHighlights = [...data.highlights];
                          newHighlights[i] = e.target.value;
                          updateData({ ...data, highlights: newHighlights });
                        }}
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed focus:outline-none"
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                        placeholder="Novo destaque principal..."
                      />
                      <button 
                        onClick={() => {
                          const newHighlights = data.highlights.filter((_, idx) => idx !== i);
                          updateData({ ...data, highlights: newHighlights });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0 mt-0.5 cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                  {data.highlights.length === 0 && (
                    <div className="py-12 bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-40">
                      <Sparkles size={24} className="mb-2 text-slate-400" />
                      <p className="text-xs font-bold uppercase tracking-wider">Nenhum destaque registado</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Next Actions Checklist */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-slate-500 dark:text-slate-400 w-4 h-4 shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('nextActions')}</h2>
                  </div>
                  <button 
                    onClick={() => updateData({ ...data, nextActions: [...data.nextActions, ''] })}
                    className="p-1.5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                    title={t('nextActions')}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {data.nextActions.map((action, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-start gap-4 transition-all hover:border-slate-300 dark:hover:border-white/10"
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
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed focus:outline-none"
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                        placeholder="Próximo passo..."
                      />
                      <button 
                        onClick={() => {
                          const newActions = data.nextActions.filter((_, idx) => idx !== i);
                          updateData({ ...data, nextActions: newActions });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all scale-90 shrink-0 mt-0.5 cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                  {data.nextActions.length === 0 && (
                    <div className="py-12 bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-center opacity-40">
                      <CheckCircle2 size={24} className="mb-2 text-slate-400" />
                      <p className="text-xs font-bold uppercase tracking-wider">Nenhum passo seguinte registado</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Quick Copy Templates (Email, CRM) */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 p-5 rounded-2xl shadow-sm space-y-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t('copyTemplatesHeader')}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Team Email Template */}
                  <div className="group relative bg-slate-50/50 dark:bg-slate-850/30 border border-slate-200/40 dark:border-white/5 rounded-xl p-3.5 space-y-2 hover:border-slate-300 dark:hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail size={15} className="text-app-green" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t('copyEmailFormat')}
                        </span>
                      </div>
                      <button
                        onClick={() => copyTemplate('email')}
                        className="p-1.5 hover:bg-app-green/10 text-slate-400 hover:text-app-green rounded-lg transition-all cursor-pointer"
                        title={t('copyEmailFormat')}
                      >
                        {copiedType === 'email' ? <Check size={14} className="text-app-green" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] leading-normal text-slate-400 dark:text-slate-500">
                      {t('copyEmailFormatDesc')}
                    </p>
                  </div>

                  {/* CRM Format Template */}
                  <div className="group relative bg-slate-50/50 dark:bg-slate-850/30 border border-slate-200/40 dark:border-white/5 rounded-xl p-3.5 space-y-2 hover:border-slate-300 dark:hover:border-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database size={15} className="text-app-green" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t('copyCrmFormat')}
                        </span>
                      </div>
                      <button
                        onClick={() => copyTemplate('crm')}
                        className="p-1.5 hover:bg-app-green/10 text-slate-400 hover:text-app-green rounded-lg transition-all cursor-pointer"
                        title={t('copyCrmFormat')}
                      >
                        {copiedType === 'crm' ? <Check size={14} className="text-app-green" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] leading-normal text-slate-400 dark:text-slate-500">
                      {t('copyCrmFormatDesc')}
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Sidebar Space: Highlights, Actions & Exports */}
        <aside className="lg:col-span-4 space-y-6 h-fit lg:sticky lg:top-28">
          
          {/* Action Panel - Exports & Backups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('exportManagement')}</span>
              <div className="flex gap-1.5">
                <button 
                  onClick={undo} 
                  disabled={!canUndo} 
                  className="p-1.5 border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo size={14} />
                </button>
                <button 
                  onClick={redo} 
                  disabled={!canRedo} 
                  className="p-1.5 border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo size={14} />
                </button>
              </div>
            </div>

            <button 
              onClick={downloadPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold tracking-wide shadow-sm transition-all cursor-pointer"
            >
              <Download size={15} /> {t('exportOfficialPdf')}
            </button>

            <button 
              onClick={downloadWord}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <FileText size={15} className="text-app-green" /> {t('exportWord')}
            </button>

            <button 
              onClick={downloadMarkdown}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Hash size={15} className="text-app-green" /> {t('exportMarkdown')}
            </button>
          </div>
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
            {/* No other buttons */}
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
                    {audioUrl ? (
                      <button 
                        onClick={() => handleJumpToTimestamp(entry.timestamp)}
                        className="text-[9px] font-mono font-semibold text-app-green hover:underline uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 bg-app-green/10 px-1.5 py-0.5 rounded-sm hover:scale-105"
                        title={language === 'portuguese' ? "Clique para ouvir este trecho do áudio" : "Click to play this section of the audio"}
                      >
                        <Play size={8} className="fill-current" />
                        [{entry.timestamp}]
                      </button>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                        [{entry.timestamp}]
                      </span>
                    )}
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
