import { GoogleGenAI, Type } from "@google/genai";
import type { HistoryItem } from "../src/services/storage";

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
       Map these voice signatures carefully and attribute them to these specified names logical to the speech content. Try to tag dialogue to these names respectively, otherwise fallback to Speaker A / Speaker B only if there's absolutely no matching speaker.`
    : "Determine speaker names sequentially (e.g. Speaker A, Speaker B).";
  
  const notesInstruction = manualNotes 
    ? `User's manual notes taken during the meeting (Prioritize these in analysis as key focus areas):\n${manualNotes}`
    : "";

  const prompt = isQuickDraft ? `
    You are an expert personal assistant and speech-to-text formatter. This is a Quick Voice Draft ("Nota de Voz Rápida").
    Clean up verbal clutter (hesitations, repeated words), and format the transcribed speech into a polished note:
    1. "summary" field: Short, friendly description of this voice note.
    2. "highlights" field: Main thoughts expressed (array of bullet points).
    3. "keyDecisions" field: Empty array unless explicit conclusions exist.
    4. "nextActions" field: Empty array unless explicit to-dos exist.
    5. "isQuickDraft" field: Set to true.
    6. "quickDraft" field:
       - "formattedNotes": Clean scratchpad markdown.
       - "taskList": List of tasks extracted.
       - "emailDraft": Professional email draft ready to copy.
    7. "transcript" field: Full transcript with timestamps.

    LANGUAGE REQUIREMENTS:
    - Output language: ${language}.
    - IF THE LANGUAGE IS PORTUGUESE: Use EUROPEAN PORTUGUESE (PT-PT) with proper UTF-8 accents (ã, á, é, ç, í, ó) and formal corporate vocabulary ("planeamento", "equipa", "utilizador").
    ${customTermsInstruction}
    ${toneInstruction}
    ${guidelinesInstruction}
  ` : `
    You are an expert business analyst and scribe. Listen to and analyze the following meeting audio.
        
    ${lowVolumeInstruction}
    ${speakersInstruction}
    ${templateInstruction}
    ${notesInstruction}
    ${customTermsInstruction}
    ${toneInstruction}
    ${guidelinesInstruction}

    Goals:
    1. ${summaryInstruction} Use Markdown for headers or bolding.
    2. "highlights": Comprehensive list of key topics and discussion points covering the entire meeting (array of strings).
    3. "keyDecisions": Explicit agreements, approvals, or conclusions reached (array of strings).
    4. "nextActions": Concrete actionable tasks with owners and deadlines.
    5. "transcript": Comprehensive chronological dialogue covering every key intervention from the beginning (00:00) through the middle to the very end of the recording. Each entry must have "speaker", "text", and accurate "timestamp" (MM:SS).
    6. "duration": Total length of the audio in seconds.

    LANGUAGE REQUIREMENTS:
    - Target Output Language: ${language}.
    - IF THE LANGUAGE IS PORTUGUESE: You MUST use EUROPEAN PORTUGUESE (PT-PT) with proper UTF-8 accents (ã, á, é, ç, í, ó). Use "planeamento" (not planejamento), "equipa" (not equipe), "utilizador" (not usuário).
    - Output a polished, final, print-ready document directly.
  `;

  // Cascade pool of Gemini models (100% Flash models with full Free Tier quota support)
  const candidateModels = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite"
  ];

  // If user selected a specific model override, put it first in the pool
  const activePool = modelOverride && candidateModels.includes(modelOverride)
    ? [modelOverride, ...candidateModels.filter(m => m !== modelOverride)]
    : candidateModels;

  const buffer = Buffer.from(audioBase64, 'base64');
  let uploadResult: any = null;
  const contentsParts: any[] = [{ text: prompt }];

  try {
    if (buffer.length > 15 * 1024 * 1024) {
      console.log(`Audio size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) is larger than 15MB. Uploading via Gemini Files API...`);
      const fileObj = new File([buffer], `audio_${Date.now()}.bin`, { type: mimeType });
      uploadResult = await ai.files.upload({ file: fileObj });
      console.log(`Uploaded to Gemini Files API. URI: ${uploadResult.uri}`);
      contentsParts.push({
        fileData: {
          fileUri: uploadResult.uri,
          mimeType: uploadResult.mimeType
        }
      });
    } else {
      contentsParts.push({
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      });
    }

    let lastError: any = null;

    for (const currentModel of activePool) {
      try {
        console.log(`[Gemini Pipeline] Attempting analysis with model: ${currentModel}...`);

        // Strict 25s circuit breaker: if any model is queued or stalls on Google Cloud, fail over immediately
        const modelTimeoutMs = 25000;
        let timeoutHandle: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Model ${currentModel} response timed out after ${modelTimeoutMs / 1000}s`));
          }, modelTimeoutMs);
        });

        const generatePromise = ai.models.generateContent({
          model: currentModel,
          contents: [
            {
              parts: contentsParts,
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                duration: { type: Type.INTEGER, description: "Audio duration in seconds" },
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

        const result = await Promise.race([generatePromise, timeoutPromise]) as any;
        clearTimeout(timeoutHandle);

        if (!result || !result.text) {
          throw new MeetingAnalysisError('EMPTY_RESPONSE', `Empty response from Gemini model ${currentModel}.`);
        }

        let textToParse = result.text.trim();
        if (textToParse.startsWith("```")) {
          const match = textToParse.match(/^```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            textToParse = match[1].trim();
          }
        }

        const parsed = JSON.parse(textToParse) as MeetingReport;
        console.log(`[Gemini Pipeline] Meeting report successfully generated by ${currentModel}!`);
        return parsed;

      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`[Gemini Pipeline] Model ${currentModel} failed: ${modelErr?.message || modelErr}. Cascading to next candidate model...`);
      }
    }

    throw lastError || new MeetingAnalysisError('API_ERROR', 'Todos os modelos Gemini do pool falharam.');

  } finally {
    if (uploadResult) {
      try {
        console.log(`Cleaning up Gemini File: ${uploadResult.name}`);
        await ai.files.delete({ name: uploadResult.name });
      } catch (deleteError) {
        console.error("Failed to delete Gemini File:", deleteError);
      }
    }
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
DATE: ${new Date(item.date).toLocaleString(language === 'portuguese' ? 'pt-PT' : 'en-US')}
CLIENT: ${item.report?.clientName || 'N/A'}
SUMMARY: ${item.report?.summary ? item.report.summary.slice(0, 400) : ''}...
-------------------`).join('\n');
  } else {
    context += "No previous meetings in archive.\n";
  }

  if (report) {
    context += `\n\nCURRENT ACTIVE MEETING (DETAILED FOCUS):\n`;
    context += `TITLE: ${historyItems.find(h => h.report.summary === report.summary)?.title || 'Selected Meeting'}
SUMMARY: ${report.summary}
HIGHLIGHTS: ${report.highlights?.join(', ') || 'None'}
DECISIONS: ${report.keyDecisions?.join(', ') || 'None reported'}
ACTIONS: ${(report.nextActions || []).map(a => typeof a === 'string' ? a : `${(a as any).task} (${(a as any).assignee})`).join(', ')}
TRANSCRIPT (SAMPLE):
${(report.transcript || []).slice(0, 80).map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}
`;
  }

  const systemInstruction = `
    You are the AI Executive Meeting Assistant for EchoNotes / SUMA. You have access to the user's meeting archive.
    
    CAPABILITIES:
    1. Cross-Meeting Analysis: Compare discussions or follow-up on topics across different dates.
    2. Deep Dive: Use the transcript and summary of the active meeting to find specific details or actions.
    3. Retrieval: Search through the index of previous meetings to answer questions.
    
    RESPONSE GUIDELINES:
    - If the user asks about "this meeting", prioritize the CURRENT ACTIVE MEETING section.
    - If the user asks about "previous meetings" or specific older projects, search the MEETING ARCHIVE CONTEXT.
    - Use Markdown for clarity (bolding, bullet points).
    - Respond in European Portuguese (PT-PT) if Portuguese is requested.
  `;

  const candidateModels = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite"
  ];

  for (const model of candidateModels) {
    try {
      const contents: any[] = [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${context}\n\nUser Question: ${query}` }]
        }
      ];

      const res = await ai.models.generateContent({
        model,
        contents
      });

      if (res && res.text) {
        return res.text;
      }
    } catch (err) {
      console.warn(`[AskGemini] Model ${model} failed, trying next candidate:`, err);
    }
  }

  return language === 'portuguese'
    ? "Desculpe, não foi possível obter uma resposta do assistente Gemini no momento."
    : "Sorry, could not retrieve a response from the Gemini assistant at this moment.";
}
