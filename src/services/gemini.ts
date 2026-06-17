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
  optimizeLowVolume: boolean = false,
  expectedSpeakers?: string[]
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

  const speakersInstruction = expectedSpeakers && expectedSpeakers.length > 0
    ? `The expected speaking participants in this session are: ${expectedSpeakers.join(', ')}.
       Map these voice signatures carefully and attribute them to these specified names logical to the speech content (e.g. if someone identifies themselves or by contextual flow, map the voices to their corresponding name from the expected participants list). Try to tag dialogue to these names respectively, otherwise fallback to Speaker A / Speaker B only if there's absolutely no matching speaker.`
    : "Determine speaker names sequentially (e.g. Speaker A, Speaker B).";

  const prompt = `
    You are an expert business analyst and scribe. Analyze the following meeting audio.
    
    ${lowVolumeInstruction}
    ${speakersInstruction}
    
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
    let result;
    let retries = 0;
    const maxRetries = 4;
    
    while (retries <= maxRetries) {
      try {
        result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
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

    if (!result || !result.text) {
      throw new MeetingAnalysisError('EMPTY_RESPONSE', 'Empty response from AI model.');
    }

    try {
      const parsed = JSON.parse(result.text);
      return parsed as MeetingReport;
    } catch (parseError) {
      console.error("JSON Parse Error:", result.text);
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

  // Build a comprehensive context string
  let context = "MEETING ARCHIVE CONTEXT:\n";
  
  if (historyItems.length > 0) {
    context += historyItems.map((item, i) => `
ID: ${item.id}
INDEX: ${i + 1}
TITLE: ${item.title}
DATE: ${new Date(item.date).toLocaleString('pt-PT')}
CLIENT: ${item.report.clientName || 'N/A'}
SUMMARY: ${item.report.summary.slice(0, 500)}...
-------------------`).join('\n');
  } else {
    context += "No previous meetings in archive.\n";
  }

  if (report) {
    context += `\n\nCURRENT ACTIVE MEETING (DETAILED FOCUS):\n`;
    context += `TITLE: ${historyItems.find(h => h.report.summary === report.summary)?.title || 'Selected Meeting'}
SUMMARY: ${report.summary}
HIGHLIGHTS: ${report.highlights.join(', ')}
DECISIONS: ${report.keyDecisions?.join(', ') || 'None reported'}
ACTIONS: ${report.nextActions.join(', ')}
TRANSCRIPT (FULL):
${report.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}
`;
  }

  const systemInstruction = `
    You are "Gemini", an AI business strategist for EchoNotes. You have access to the user's meeting archive.
    
    CAPABILITIES:
    1. Cross-Meeting Analysis: Compare discussions or follow-up on topics across different dates.
    2. Deep Dive: Use the FULL TRANSCRIPT of the active meeting to find specific details, technical terms, or exact quotes.
    3. Retrieval: Search through the INDEX of previous meetings to answer questions about the past.

    RESPONSE GUIDELINES:
    - If the user asks about "this meeting", prioritize the CURRENT ACTIVE MEETING section.
    - If the user asks about "previous meetings" or specific older projects, search the MEETING ARCHIVE CONTEXT.
    - Always state which meeting(s) you are referencing in your answer.
    - Use Markdown for clarity (bolding, lists).
    - Language: Respond in the same language as the user.
    - PORTUGUESE (PT-PT): Use European Portuguese grammar/vocab. Focus on UTF-8 correct accents (ã, á, é, ç, etc.).
  `;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
      },
      history: chatHistory.length > 0 ? chatHistory : [
        {
          role: 'user',
          parts: [{ text: `System Context Injection:\n${context}` }]
        },
        {
          role: 'model',
          parts: [{ text: "Context synchronized. I am ready to analyze your specific meetings or your entire history. How can I assist you?" }]
        }
      ]
    });

    const result = await chat.sendMessage({ message: query });
    return result.text || "Desculpe, não consegui obter uma resposta.";
  } catch (error) {
    console.error("Ask Gemini Error:", error);
    throw new Error("AI interaction failed.");
  }
}
