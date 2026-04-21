import { GoogleGenAI, Type } from "@google/genai";
import { HistoryItem } from "./storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MeetingReport {
  summary: string;
  highlights: string[];
  nextActions: string[];
  keyDecisions: string[];
  transcript: { speaker: string; text: string; timestamp: string }[];
  clientName?: string;
  meetingDate?: string;
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
  optimizeLowVolume: boolean = false
): Promise<MeetingReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "") {
    throw new MeetingAnalysisError('CONFIG_ERROR', 'Gemini API key not found. Please set the GEMINI_API_KEY environment variable.');
  }

  const lowVolumeInstruction = optimizeLowVolume 
    ? "The audio recording has low volume or background noise. Use advanced signal processing and context reasoning to accurately transcribe every word. Pay extra attention to faint voices."
    : "";

  const summaryInstruction = detailLevel === 'concise' 
    ? "Provide a very concise executive summary (max 3 sentences)." 
    : "Provide a detailed executive summary covering all key aspects.";

  const prompt = `
    You are an expert business analyst and scribe. Analyze the following meeting audio.
    
    ${lowVolumeInstruction}
    
    Goals: Capture essence, outcomes, and specific commitments.
    
    1. ${summaryInstruction} Use Markdown for headers or bolding.
    2. "Key Highlights": Most important topics and data points.
    3. "Key Decisions": Agreements, approvals, or conclusions.
    4. "Next Actions": Concrete tasks with owners and deadlines.
    5. "Comprehensive Transcript": Full word-for-word transcript with speaker identification and timestamps.

    LANGUAGE REQUIREMENTS:
    - Output language for summary, highlights, decisions, and next actions: ${language}.
    - IF THE LANGUAGE IS PORTUGUESE: You MUST use EUROPEAN PORTUGUESE (PT-PT).
    - CRITICAL: Use correct UTF-8 encoding for Portuguese characters (ã, á, é, ç, í, ó, etc.). 
    - Ensure all accents (agudo, circunflexo, til, grave) are correctly applied. Do NOT use escape sequences. 
    - VOCABULARY: Use "planeamento" (not planejamento), "equipa" (not equipe), "utilizador" (not usuário).
    - The transcript remains in the original language spoken.
  `;

  try {
    let response;
    let retries = 0;
    const maxRetries = 4;
    
    while (retries <= maxRetries) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                keyDecisions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                transcript: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      speaker: { type: Type.STRING },
                      text: { type: Type.STRING },
                      timestamp: { type: Type.STRING, description: "Format MM:SS" },
                    },
                    required: ["speaker", "text", "timestamp"],
                  },
                },
              },
              required: ["summary", "highlights", "keyDecisions", "nextActions", "transcript"],
            },
          },
        });
        break;
      } catch (apiError: any) {
        const isTransientError = apiError?.message?.includes('503') || apiError?.status === 503 || apiError?.message?.includes('429') || apiError?.status === 429;
        
        if (isTransientError && retries < maxRetries) {
          retries++;
          const backoffTime = 5000 * Math.pow(2, retries - 1);
          console.warn(`Retry attempt ${retries}/${maxRetries} after ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        throw apiError;
      }
    }

    if (!response || !response.text) {
      throw new MeetingAnalysisError('EMPTY_RESPONSE', 'Empty response from AI model.');
    }

    try {
      const parsed = JSON.parse(response.text);
      return parsed as MeetingReport;
    } catch (parseError) {
      console.error("JSON Parse Error:", response.text);
      throw new MeetingAnalysisError('PARSE_ERROR', 'Failed to parse the structured report.');
    }
  } catch (error) {
    if (error instanceof MeetingAnalysisError) throw error;
    console.error("Gemini API Error:", error);
    throw new MeetingAnalysisError('API_ERROR', `AI Service Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export async function askGemini(query: string, report: MeetingReport | null, historyItems: HistoryItem[] = [], chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "") {
    throw new Error('Gemini API key not found.');
  }

  let context = "";
  if (report) {
    context = `
      Context: This is a specific meeting report.
      Summary: ${report.summary}
      Highlights: ${report.highlights.join(', ')}
      Key Decisions: ${report.keyDecisions?.join(', ') || 'None'}
      Next Actions: ${report.nextActions.join(', ')}
      Transcript: ${report.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}
    `;
  } else if (historyItems.length > 0) {
    context = `
      Context: This is a collection of recent meeting summaries.
      Meetings:
      ${historyItems.map((item, i) => `
        Meeting ${i + 1}: ${item.title} (${new Date(item.date).toLocaleDateString()})
        Summary: ${item.report.summary}
      `).join('\n')}
    `;
  } else {
    context = "No context available.";
  }

  const systemInstruction = `
    You are "Gemini", an AI assistant for EchoNotes. Help users understand their meetings.
    Always respond in the same language as the user's query.
    IF PORTUGUESE: Use European Portuguese (PT-PT). Ensure correct UTF-8 accents and vocabulary.
  `;

  try {
    const chat = ai.chats.create({
      model: "gemini-1.5-flash",
      config: {
        systemInstruction,
      },
      history: chatHistory.length > 0 ? chatHistory : [
        {
          role: 'user',
          parts: [{ text: `Context: ${context}` }]
        },
        {
          role: 'model',
          parts: [{ text: "Analysis complete. How can I help?" }]
        }
      ]
    });

    const response = await chat.sendMessage({ message: query });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Ask Gemini Error:", error);
    throw new Error("AI interaction failed.");
  }
}
