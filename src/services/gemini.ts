import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
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
    throw new MeetingAnalysisError('CONFIG_ERROR', 'Chave da API Gemini não encontrada. Se estiver no Vercel, adicione a variável de ambiente GEMINI_API_KEY nas definições do projeto e faça um novo Deploy.');
  }

  const lowVolumeInstruction = optimizeLowVolume 
    ? "The audio recording has low volume or background noise. Please use your advanced signal processing and context reasoning to accurately transcribe every word, even the quiet ones. Pay extra attention to faint voices."
    : "";

  const summaryInstruction = detailLevel === 'concise' 
    ? "Provide a very concise executive summary (max 3 sentences)." 
    : "Provide a detailed executive summary covering all key aspects.";

  const prompt = `
    You are an expert business analyst and meeting scribe. Analyze the provided meeting audio and generate a high-quality, professional report.
    
    ${lowVolumeInstruction}
    
    Your goal is to capture the essence, outcomes, and specific commitments made during the conversation.
    
    1. ${summaryInstruction} Focus on the "Why" and "What" of the meeting. Use professional Markdown formatting (bolding, italics, sub-headings) where appropriate to improve readability.
    2. "Key Highlights": Identify the most important topics, insights, and data points discussed. Provide clear, concise points.
    3. "Key Decisions": List all specific agreements, approvals, or conclusions reached.
    4. "Next Actions": Identify concrete tasks, who is responsible, and any mentioned deadlines. Be as specific as possible.
    5. "Comprehensive Transcript":
       - Provide a complete, word-for-word transcript.
       - Identify distinct speakers based on context (e.g., "Project Manager", "Client", "Developer") if names aren't clear.
       - Ensure accurate timestamps for every turn.
       - Preserve the original tone and technical terminology.

    IMPORTANT: The output language for the summary, highlights, decisions, and next actions MUST be in ${language}. 
    If the language is Portuguese, you MUST use European Portuguese (PT-PT) grammar and vocabulary. 
    Specifically, avoid Brazilian Portuguese (PT-BR) terms such as "planejamento" (use "planeamento" instead), "equipe" (use "equipa"), "usuário" (use "utilizador"), etc.
    The transcript should remain in the original language spoken in the audio.

    Return the result in JSON format with the following structure:
    {
      "summary": "...",
      "highlights": ["...", "..."],
      "keyDecisions": ["...", "..."],
      "nextActions": ["...", "..."],
      "transcript": [{"speaker": "...", "text": "...", "timestamp": "..."}]
    }
  `;

  try {
    let response;
    let retries = 0;
    const maxRetries = 4;
    
    while (retries <= maxRetries) {
      try {
        response = await ai.models.generateContent({
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
        break; // Success, exit retry loop
      } catch (apiError: any) {
        // Check if it's a 503 error or 429 (Too Many Requests)
        const isTransientError = apiError?.message?.includes('503') || apiError?.status === 503 || JSON.stringify(apiError).includes('503') || apiError?.message?.includes('429') || apiError?.status === 429;
        
        if (isTransientError && retries < maxRetries) {
          retries++;
          const backoffTime = 5000 * Math.pow(2, retries - 1); // 5s, 10s, 20s, 40s
          console.warn(`Gemini API transient error. Retry attempt ${retries}/${maxRetries}. Waiting ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime)); // Exponential backoff
          continue;
        }
        throw apiError; // Re-throw if not transient or max retries reached
      }
    }

    if (!response || !response.text) {
      throw new MeetingAnalysisError('EMPTY_RESPONSE', 'The AI model returned an empty response. The audio might be too short or silent.');
    }

    try {
      const parsed = JSON.parse(response.text);
      // Basic validation of the parsed object
      if (!parsed.summary || !Array.isArray(parsed.highlights) || !Array.isArray(parsed.nextActions) || !Array.isArray(parsed.keyDecisions)) {
        throw new Error('Invalid report structure');
      }
      return parsed as MeetingReport;
    } catch (parseError) {
      console.error("Failed to parse report JSON:", response.text);
      throw new MeetingAnalysisError('PARSE_ERROR', 'Failed to process the AI response into a structured report.');
    }
  } catch (error) {
    if (error instanceof MeetingAnalysisError) throw error;
    
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
    throw new MeetingAnalysisError('API_ERROR', `AI Service Error: ${errorMessage}`);
  }
}

export async function askGemini(query: string, report: MeetingReport | null, historyItems: HistoryItem[] = [], chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "") {
    throw new Error('Chave da API Gemini não encontrada. Configure a variável GEMINI_API_KEY no seu ambiente de deploy.');
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
        Key Decisions: ${item.report.keyDecisions?.join(', ') || 'None'}
      `).join('\n')}
    `;
  } else {
    context = "No meeting context available yet.";
  }

  const systemInstruction = `
    You are "Gemini", an AI assistant for EchoNotes. You help users understand their meetings.
    Use the provided context to answer questions accurately. 
    If the answer isn't in the context, say you don't know based on the meetings provided, but you can offer general advice if relevant.
    Keep answers concise and professional.
    Always respond in the same language as the user's query.
    If the response is in Portuguese, you MUST use European Portuguese (PT-PT) grammar and vocabulary. 
    Avoid Brazilian Portuguese (PT-BR) terms such as "planejamento" (use "planeamento"), "equipe" (use "equipa"), "usuário" (use "utilizador"), etc.
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
          parts: [{ text: `Here is the context: ${context}` }]
        },
        {
          role: 'model',
          parts: [{ text: "I have analyzed the context. How can I help you today?" }]
        }
      ]
    });

    const response = await chat.sendMessage({ message: query });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Ask Gemini Error:", error);
    throw new Error("Failed to get a response from Gemini.");
  }
}
