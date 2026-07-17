import { GoogleGenAI, Type } from "@google/genai";
import type { HistoryItem } from "./storage";

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

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "") {
    throw new MeetingAnalysisError('CONFIG_ERROR', 'Gemini API key not found. Please set the GEMINI_API_KEY environment variable.');
  }
  return new GoogleGenAI({ apiKey });
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
  const ai = getAI();

  const lowVolumeInstruction = optimizeLowVolume 
    ? "The audio recording has low volume or background noise. Use advanced signal processing and context reasoning to accurately transcribe every word. Pay extra attention to faint voices."
    : "";
  const summaryInstruction = detailLevel === 'concise' 
    ? "Provide a very concise executive summary (max 3 sentences)." 
    : "Provide a detailed executive summary covering all key aspects.";
  
  const templateInstruction = `Template to follow: ${template}. Adjust structure and tone based on this template: if 'client_meeting', focus on client needs, relationship building, and agreed action items; if 'internal_meeting', focus on team alignment, operational clarity, and accountability; if 'brainstorming', be creative, capture all ideas, and identify potential paths forward; if 'standard', provide a balanced, comprehensive summary.`;

  const toneInstruction = tone
    ? `TONE OF THE REPORT: Please write the report with a ${tone} tone.
       - If 'professional', use a polished, formal, and structured business tone.
       - If 'technical', use a precise, direct, and spec-focused tone with industry/technical terms.
       - If 'casual', use an approachable, light, easy-to-read, and conversational tone.
       - If 'action_oriented', use an extremely actionable, results-oriented, and structured tone, putting tasks and deadlines first.`
    : "TONE OF THE REPORT: Professional, structured and clear.";

  const guidelinesInstruction = customGuidelines && customGuidelines.trim() !== ""
    ? `ADDITIONAL SYSTEM GUIDELINES: Strictly apply the following instruction/formatting rules requested by the user:
       "${customGuidelines}"`
    : "";

  const customTermsInstruction = customTerms && customTerms.trim() !== ""
    ? `IMPORTANT: The following terms are specific to the user and must be recognized and spelled correctly in the transcript and summary (do NOT autocorrect these to similar sounding words): ${customTerms}.`
    : "";

  const speakersInstruction = expectedSpeakers && expectedSpeakers.length > 0
    ? `The expected speaking participants in this session are: ${expectedSpeakers.join(', ')}.
       Map these voice signatures carefully and attribute them to these specified names logical to the speech content (e.g. if someone identifies themselves or by contextual flow, map the voices to their corresponding name from the expected participants list). Try to tag dialogue to these names respectively, otherwise fallback to Speaker A / Speaker B only if there's absolutely no matching speaker.`
    : "Determine speaker names sequentially (e.g. Speaker A, Speaker B).";
  
  const notesInstruction = manualNotes 
    ? `User's manual notes taken during the meeting (Prioritize these in analysis as key focus areas):\n${manualNotes}`
    : "";

  const prompt = isQuickDraft ? `
    You are an expert personal assistant and speech-to-text formatter. This is NOT a standard meeting, but rather a Quick Voice Draft ("Nota de Voz Rápida").
    The user is recording a quick personal note, a thought, a walk-and-talk idea, or a direct voice dictation.
    Goals: Clean up verbal clutter (remove "humm", "like", "you know", hesitations, repeated words), and format the transcribed speech into a beautiful, highly useful personal note:
        1. "summary" field: Provide a short, friendly, and descriptive title or 1-sentence description of this quick draft (e.g., "Ideia para nova funcionalidade").
    2. "highlights" field: Summarize the main thoughts expressed (as a brief array of bullet points).
    3. "keyDecisions" field: Keep empty array unless explicit conclusions are made (keep as string[]).
    4. "nextActions" field: Keep empty array unless explicit tasks/to-dos are dictated.
    5. "isQuickDraft" field: Set to true.
    6. "quickDraft" field: Structure the voice draft beautifully. Populate it with:
       - "formattedNotes": A clean scratchpad / markdown block formatting the transcription elegantly (with nice paragraphs, clean bullet points, or polished narrative style).
       - "taskList": A structured list of tasks/to-dos extracted from the dictation.
       - "emailDraft": A professional email draft based on what the user was talking about, formatted with a Subject line and clean greetings, ready to copy and paste.
    7. "transcript" field: Provide the word-for-word transcript with speaker identification ("Utilizador" or "User") and timestamps.
    LANGUAGE REQUIREMENTS:
    - Output language for summary, highlights, decisions, formattedNotes, taskList, emailDraft and next actions: ${language}.
    - IF THE LANGUAGE IS PORTUGUESE: You MUST use EUROPEAN PORTUGUESE (PT-PT).
    - CRITICAL: Use correct UTF-8 encoding for Portuguese characters (ã, á, é, ç, í, ó, etc.). 
     - Ensure all accents (agudo, circunflexo, til, grave) are correctly applied. Do NOT use escape sequences. 
     - VOCABULARY: Use "planeamento" (not planejamento), "equipa" (not equipe), "utilizador" (not usuário).
    - The transcript remains in the original language spoken.
    ${customTermsInstruction}
    ${toneInstruction}
    ${guidelinesInstruction}
  ` : `
    You are an expert business analyst and scribe. Analyze the following meeting audio.
        
    ${lowVolumeInstruction}
    ${speakersInstruction}
    ${templateInstruction}
    ${notesInstruction}
    ${customTermsInstruction}
    ${toneInstruction}
    ${guidelinesInstruction}

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

  let modelName = modelOverride || "gemini-3.5-flash";
  try {
    let retries = 0;
    const maxRetries = 3;
    
    while (true) {
      try {
        console.log(`Starting meeting analysis using model: ${modelName}...`);
        const result = await ai.models.generateContent({
          model: modelName,
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
                isQuickDraft: { type: Type.BOOLEAN },
                quickDraft: {
                  type: Type.OBJECT,
                  properties: {
                    formattedNotes: { type: Type.STRING },
                    taskList: { type: Type.ARRAY, items: { type: Type.STRING } },
                    emailDraft: { type: Type.STRING }
                  },
                  required: ["formattedNotes", "taskList", "emailDraft"]
                }
              },
              required: ["summary", "highlights", "keyDecisions", "nextActions", "transcript"],
            },
          },
        });

        if (!result || !result.text) {
          throw new MeetingAnalysisError('EMPTY_RESPONSE', 'Empty response from AI model.');
        }

        let textToParse = result.text.trim();
        if (textToParse.startsWith("```")) {
          const match = textToParse.match(/^```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            textToParse = match[1].trim();
          }
        }

        const parsed = JSON.parse(textToParse) as MeetingReport;
        try {
          console.log("Automatically running post-process step to clean spelling errors and typos...");
          const corrected = await postProcessReport(parsed, language);
          return corrected;
        } catch (postErr) {
          console.error("Auto post-processing encountered an error, returning original parsed report.", postErr);
          return parsed;
        }

      } catch (err: any) {
        const isQuotaOrServerFail = 
          err?.message?.includes('503') || 
          err?.status === 503 || 
          err?.message?.includes('429') || 
          err?.status === 429 ||
          err?.message?.includes('exhausted') ||
          err?.message?.includes('rate limit') ||
          err?.message?.includes('overloaded') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('high demand') ||
          err?.message?.toLowerCase().includes('demand');
        
        if (isQuotaOrServerFail && modelName === "gemini-2.5-pro") {
          console.warn(`Model ${modelName} rate-limited or unavailable. Automatically falling back to gemini-3.5-flash...`);
          modelName = "gemini-3.5-flash";
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        if (isQuotaOrServerFail && modelName === "gemini-3.5-flash") {
          console.warn(`Model ${modelName} rate-limited or unavailable (Overloaded/High demand). Automatically falling back to highly available gemini-2.5-flash...`);
          modelName = "gemini-2.5-flash";
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        const isParseOrEmptyError = 
          (err instanceof MeetingAnalysisError && (err.type === 'EMPTY_RESPONSE' || err.type === 'PARSE_ERROR')) || 
          err instanceof SyntaxError;
        
        const isNetworkError = !err?.status && err?.message?.toLowerCase().includes('fetch');

        if ((isQuotaOrServerFail || isParseOrEmptyError || isNetworkError || !err?.status) && retries < maxRetries) {
          retries++;
          const backoffTime = 2000 * Math.pow(2, retries - 1);
          console.warn(`Retry attempt ${retries}/${maxRetries} after ${backoffTime}ms with model ${modelName} due to: ${err?.message || err}...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }

        if (err instanceof SyntaxError || (err instanceof MeetingAnalysisError && err.type === 'PARSE_ERROR')) {
          throw new MeetingAnalysisError('PARSE_ERROR', 'Falha ao processar a transcrição estruturada após várias tentativas.');
        }
        
        if (err instanceof MeetingAnalysisError) throw err;
        
        const friendlyMsg = language === 'portuguese'
          ? `O serviço de IA está com elevada procura de momento ou atingiu o limite gratuito de pedidos. Por favor, aguarde alguns instantes e clique em "Tentar Novamente" ou configure a faturação na consola para obter limites superiores.`
          : `AI service is currently experiencing extremely high demand or has reached its free tier rate limit. Please wait a brief moment and click "Try Again", or configure billing to increase your rate limits.`;
          
        throw new MeetingAnalysisError('API_ERROR', friendlyMsg);
      }
    }
  } catch (error) {
    if (error instanceof MeetingAnalysisError) throw error;
    console.error("Gemini API Error:", error);
    const friendlyMsg = language === 'portuguese'
      ? `Erro do Serviço de IA: O modelo está temporariamente indisponível. Por favor tente de novo. (Modelo: ${modelName})`
      : `AI Service Error: The model is temporarily unavailable. Please try again. (Model: ${modelName})`;
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
  const ai = getAI();

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

  let modelName = "gemini-3.5-flash";
  let attempts = 0;
  while (attempts < 2) {
    try {
      console.log(`Sending question to Gemini using model: ${modelName}...`);
      const chat = ai.chats.create({
        model: modelName,
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
    } catch (error: any) {
      console.error(`Ask Gemini Error with ${modelName}:`, error);
      const isQuotaOrServerFail = 
        error?.message?.includes('503') || 
        error?.status === 503 || 
        error?.message?.includes('429') || 
        error?.status === 429 ||
        error?.message?.includes('exhausted') ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('UNAVAILABLE') ||
        error?.message?.includes('high demand') ||
        error?.message?.toLowerCase().includes('demand');

      if (isQuotaOrServerFail && modelName === "gemini-3.5-flash" && attempts === 0) {
        console.warn("Falling back to gemini-2.5-flash for chat conversation due to quota/rate limits...");
        modelName = "gemini-2.5-flash";
        attempts++;
        continue;
      }
      throw new Error("AI interaction failed.");
    }
  }
  throw new Error("AI interaction failed.");
}

export async function postProcessReport(report: MeetingReport, language: string): Promise<MeetingReport> {
  const ai = getAI();

  const prompt = `
    You are an expert copyeditor specializing in cleansing raw speech-to-text transcriptions and executive summaries.
    Review the provided meeting report JSON and correct common spelling errors, grammatical mistakes, awkward typos, or phonetic transcription hiccups.

    CRITICAL INSTRUCTIONS:
    1. Do NOT change speaker names, timestamps, or core meeting stats.
    2. Do NOT invent new discussions, delete statements, or hallucinate. Keep the facts identical to the original report.
    3. Ensure the grammatical tone is highly professional and correct for the target language: "${language}".
    4. IF THE LANGUAGE IS PORTUGUESE (PT-PT): Use European Portuguese spelling rules (utilize words like "planeamento", "equipa" and correct UTF-8 accents).
    5. Clean syntax errors in the transcript but maintain the unique conversational voice of each participant.
    6. Return the updated content matching the exact JSON schema provided.

    ORIGINAL REPORT JSON:
    ${JSON.stringify(report)}
  `;

  let modelName = "gemini-3.5-flash";
  let attempts = 0;
  while (attempts < 2) {
    try {
      console.log(`Running post-process report correction using model: ${modelName}...`);
      const result = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [{ text: prompt }]
          }
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
                    timestamp: { type: Type.STRING },
                  },
                  required: ["speaker", "text", "timestamp"],
                },
              },
              isQuickDraft: { type: Type.BOOLEAN },
              quickDraft: {
                type: Type.OBJECT,
                properties: {
                  formattedNotes: { type: Type.STRING },
                  taskList: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emailDraft: { type: Type.STRING }
                },
                required: ["formattedNotes", "taskList", "emailDraft"]
              },
              clientName: { type: Type.STRING },
              meetingDate: { type: Type.STRING },
            },
            required: ["summary", "highlights", "keyDecisions", "nextActions", "transcript"],
          },
        }
      });

      if (!result || !result.text) {
        return report;
      }

      let textToParse = result.text.trim();
      if (textToParse.startsWith("```")) {
        const match = textToParse.match(/^```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          textToParse = match[1].trim();
        }
      }

      const corrected = JSON.parse(textToParse);
      return { ...report, ...corrected } as MeetingReport;
    } catch (err: any) {
      const isQuotaOrServerFail = 
        err?.message?.includes('503') || 
        err?.status === 503 || 
        err?.message?.includes('429') || 
        err?.status === 429 ||
        err?.message?.includes('exhausted') ||
        err?.message?.includes('rate limit') ||
        err?.message?.includes('overloaded') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('high demand') ||
        err?.message?.toLowerCase().includes('demand');

      if (isQuotaOrServerFail && modelName === "gemini-3.5-flash" && attempts === 0) {
        console.warn("Falling back to gemini-2.5-flash for post-processing task...");
        modelName = "gemini-2.5-flash";
        attempts++;
        continue;
      }

      console.error(`Failed to post-process meeting report with model ${modelName}:`, err);
      return report;
    }
  }
  return report;
}
