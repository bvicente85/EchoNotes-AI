import { HistoryItem } from "./storage";

export interface MeetingReport {
  summary: string;
  highlights: string[];
  nextActions: string[];
  keyDecisions: string[];
  transcript: { speaker: string; text: string; timestamp: string }[];
  clientName?: string;
  meetingDate?: string;
  title?: string;
  isQuickDraft?: boolean;
  quickDraft?: {
    formattedNotes: string;
    taskList: string[];
    emailDraft: string;
  };
  manualNotes?: string;
  template?: string;
  downloaded?: boolean;
  downloadedFormats?: string[];
  duration?: number;
  startTime?: string;
  endTime?: string;
  analyzedAt?: string;
}

export class MeetingAnalysisError extends Error {
  constructor(public type: 'API_ERROR' | 'PARSE_ERROR' | 'EMPTY_RESPONSE' | 'CONFIG_ERROR', message: string) {
    super(message);
    this.name = 'MeetingAnalysisError';
  }
}

export async function generateMeetingReport(
  audioBase64: string, 
  mimeType: string, 
  detailLevel: string = 'detailed', 
  language: string = 'english',
  optimizeLowVolume: boolean = false,
  expectedSpeakers?: string[],
  isQuickDraft: boolean = false,
  manualNotes?: string,
  template: string = 'standard',
  customTerms?: string,
  modelOverride?: string,
  tone?: string,
  customGuidelines?: string
): Promise<MeetingReport> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        detailLevel,
        language,
        optimizeLowVolume,
        expectedSpeakers,
        isQuickDraft,
        manualNotes,
        template,
        customTerms,
        modelOverride,
        tone,
        customGuidelines
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new MeetingAnalysisError(
        errData.type || 'API_ERROR', 
        errData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    return data as MeetingReport;
  } catch (error: any) {
    if (error instanceof MeetingAnalysisError) throw error;
    console.error("Client generateMeetingReport Error:", error);
    // Return friendly local language error message
    const friendlyMsg = language === 'portuguese'
      ? "Falha ao ligar ao servidor de IA. Por favor, verifique a sua ligação."
      : "Failed to connect to the AI server. Please check your connection.";
    throw new MeetingAnalysisError('API_ERROR', friendlyMsg);
  }
}

export async function askGemini(
  query: string, 
  report: MeetingReport | null, 
  historyItems: HistoryItem[] = [], 
  chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  language: string = 'english'
): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        report,
        historyItems,
        chatHistory,
        language
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.response || "Desculpe, não consegui obter uma resposta.";
  } catch (error: any) {
    console.error("Client askGemini Error:", error);
    return language === 'portuguese' 
      ? "Lamentamos, mas não foi possível contactar o assistente de IA. Por favor, tente novamente." 
      : "We're sorry, but we could not connect to the AI assistant. Please try again.";
  }
}
