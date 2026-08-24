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
  if (!modelOverride || modelOverride === "groq-llama-3.3" || !modelOverride.startsWith("gemini")) {
    return generateMeetingReportWithGroq(
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
    );
  }

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
    - SPELLING & QUALITY: Pay extreme attention to spelling, technical terms, grammar, and typos. Ensure names and custom terms are spelled correctly in the transcript and summary. Output a polished, final, print-ready document directly.
    - The transcript remains in the original language spoken.
  `;

  // Map user-friendly model strings to actual Google Gemini model IDs
  let modelName = modelOverride || "gemini-2.5-flash";
  if (modelName === "gemini-3.5-flash" || modelName === "gemini-3.5-flash-lite" || modelName === "gemini-3.6-flash") {
    modelName = "gemini-2.5-flash";
  }
  try {
    let retries = 0;
    const maxRetries = 3;
    
    while (true) {
      let uploadResult: any = null;
      try {
        console.log(`Starting meeting analysis using model: ${modelName}...`);
        
        const buffer = Buffer.from(audioBase64, 'base64');
        const contentsParts: any[] = [{ text: prompt }];

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

        let result;
        try {
          result = await ai.models.generateContent({
            model: modelName,
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
        // Return the parsed report directly. We instruct the model in the main prompt
        // to do correct spelling in the first pass to fit Vercel's strict 10s execution limits.
        return parsed;

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
        
        if (isQuotaOrServerFail && process.env.GROQ_API_KEY) {
          console.warn("Gemini quota exhausted or service overloaded. Instantly falling back to Groq for zero-delay recovery...");
          try {
            return await generateMeetingReportWithGroq(
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
              "groq-llama-3.3",
              tone,
              customGuidelines
            );
          } catch (groqErr) {
            console.error("Groq fallback also failed:", groqErr);
          }
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
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable not configured.");
  }

  let context = "MEETING ARCHIVE CONTEXT:\n";
  if (historyItems.length > 0) {
    context += historyItems.map((item, i) => `
ID: ${item.id}
INDEX: ${i + 1}
TITLE: ${item.title}
DATE: ${new Date(item.date).toLocaleString('pt-PT')}
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
ACTIONS: ${(report.nextActions || []).map(a => typeof a === 'string' ? a : `${a.task} (${a.assignee})`).join(', ')}
TRANSCRIPT (SAMPLE/RECENT):
${(report.transcript || []).slice(0, 100).map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}
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

  const messages: any[] = [
    { role: "system", content: `${systemInstruction}\n\n${context}` }
  ];

  for (const h of chatHistory) {
    const role = h.role === 'model' ? 'assistant' : 'user';
    const text = (h.parts || []).map((p: any) => p.text || '').join('\n');
    if (text.trim()) {
      messages.push({ role, content: text });
    }
  }

  messages.push({ role: "user", content: query });

  const candidateModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "groq/compound"];
  for (const model of candidateModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 2048
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawMsg = data.choices?.[0]?.message;
        const text = rawMsg?.content || rawMsg?.reasoning || rawMsg?.reasoning_content || "";
        if (text.trim()) {
          return text;
        }
      }
    } catch (err) {
      console.warn(`Groq chat model ${model} failed, trying next candidate:`, err);
    }
  }

  throw new Error("Assistente de IA temporariamente indisponível.");
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

export async function generateMeetingReportWithGroq(
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
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new MeetingAnalysisError('CONFIG_ERROR', 'Groq API Key not found. Please set the GROQ_API_KEY environment variable.');
  }

  console.log("Transcribing audio using Groq Whisper-Large-V3...");
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const fileExt = mimeType.split('/')[1]?.split(';')[0] || 'wav';
  const fileObj = new File([audioBuffer], `audio.${fileExt}`, { type: mimeType });

  const formData = new FormData();
  formData.append('file', fileObj);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('language', language === 'portuguese' ? 'pt' : 'en');
  formData.append('prompt', language === 'portuguese' ? 'Ata de reunião executiva em português de Portugal (PT-PT).' : 'Executive business meeting minutes.');
  formData.append('temperature', '0');

  let transcribeData: any = null;
  let transcribeRetries = 0;
  const maxTranscribeRetries = 3;
  
  while (true) {
    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`
      },
      body: formData
    });

    if (transcribeRes.ok) {
      transcribeData = await transcribeRes.json();
      break;
    }

    const errorText = await transcribeRes.text();
    const isRateLimit = transcribeRes.status === 429 || errorText.includes("rate_limit") || errorText.includes("429");
    
    if (isRateLimit && transcribeRetries < maxTranscribeRetries) {
      transcribeRetries++;
      const waitTime = 3000 * transcribeRetries;
      console.warn(`Groq Transcribe rate-limited. Retrying attempt ${transcribeRetries}/${maxTranscribeRetries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    console.error("Groq Transcribe Error:", errorText);
    throw new MeetingAnalysisError('API_ERROR', `Failed to transcribe audio with Groq: ${transcribeRes.status}`);
  }

  const segments = transcribeData.segments || [];
  console.log(`Audio transcribed successfully with ${segments.length} segments.`);

  // Format segments with timestamps for LLM diarization
  const formattedSegments = segments.map((seg: any, idx: number) => {
    const minutes = Math.floor(seg.start / 60).toString().padStart(2, '0');
    const seconds = Math.floor(seg.start % 60).toString().padStart(2, '0');
    const timestamp = `${minutes}:${seconds}`;
    return {
      index: idx,
      timestamp,
      text: seg.text.trim()
    };
  });

  const formattedSegmentsText = formattedSegments.map((s: any) => `[${s.timestamp}] Segment ${s.index}: "${s.text}"`).join('\n');

  console.log("Calling Groq Llama-3.3-70b-versatile for meeting report synthesis...");

  // Build prompt instructions
  // Build prompt instructions
  const lowVolumeInstruction = optimizeLowVolume 
    ? "The audio had low volume. Pay extra attention to faint dialogue."
    : "";
  
  const toneInstruction = tone
    ? `TONE: Use a ${tone} tone (professional: formal/structured; technical: precise/spec-focused; casual: conversational; action_oriented: tasks/deadlines first).`
    : "TONE: Professional, structured, clear and executive.";

  const guidelinesInstruction = customGuidelines && customGuidelines.trim() !== ""
    ? `ADDITIONAL RULES: ${customGuidelines}`
    : "";

  const customTermsInstruction = customTerms && customTerms.trim() !== ""
    ? `SPECIFIC TERMS (do not correct/change spelling of these): ${customTerms}.`
    : "";

  const speakersInstruction = expectedSpeakers && expectedSpeakers.length > 0
    ? `The expected speaking participants in this session are: ${expectedSpeakers.join(', ')}.`
    : "Determine speaker names sequentially (e.g. Speaker A, Speaker B).";
  
  const notesInstruction = manualNotes 
    ? `User's manual notes (Prioritize these key focus areas):\n${manualNotes}`
    : "";

  const finalPrompt = `
    You are an expert executive meeting secretary and business intelligence analyst for EchoNotes.
    Analyze the following meeting transcript segments and produce a comprehensive, structured executive meeting report.
    
    ${lowVolumeInstruction}
    ${speakersInstruction}
    ${notesInstruction}
    ${customTermsInstruction}
    ${toneInstruction}
    ${guidelinesInstruction}

    REPORT REQUIREMENTS:
    1. "summary": A clear, polished, and comprehensive executive summary capturing the meeting objectives, context, and key outcomes.
    2. "highlights": Key discussion topics, insights, and data points analyzed during the session.
    3. "keyDecisions": Explicit agreements, approvals, consensus, or strategic decisions made.
    4. "nextActions": Concrete action items with designated owners and target deadlines.
    5. "speakers": A string array containing the mapped speaker name for each Segment index (from 0 to ${formattedSegments.length - 1}).

    LANGUAGE REQUIREMENTS:
    - Target Output Language: ${language}.
    - IF THE LANGUAGE IS PORTUGUESE: You MUST use EUROPEAN PORTUGUESE (PT-PT) with proper UTF-8 accents and formal corporate vocabulary (use "planeamento", "equipa", "utilizador").
    - IF THE LANGUAGE IS ENGLISH: Use formal, professional business English.

    Return ONLY a valid JSON object matching this schema:
    {
      "summary": "Comprehensive executive summary string",
      "highlights": ["Key discussion point 1", "Key discussion point 2"],
      "keyDecisions": ["Agreed decision 1"],
      "nextActions": [
        {
          "task": "Actionable task description",
          "assignee": "Responsible person or Team",
          "dueDate": "YYYY-MM-DD or TBD"
        }
      ],
      "speakers": ["Speaker Name for Segment 0", "Speaker Name for Segment 1"]
    }
  `;

  let resultText = "";
  const candidateModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "groq/compound"];
  let modelIndex = 0;
  let chatRetries = 0;
  const maxChatRetries = 8;
  
  while (chatRetries < maxChatRetries) {
    const currentModel = candidateModels[modelIndex % candidateModels.length];
    console.log(`Calling Groq model ${currentModel} for meeting report synthesis...`);

    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: `Here are the meeting segments:\n\n${formattedSegmentsText}` }
        ],
        temperature: 0.1,
        max_tokens: 4096
      })
    });

    if (chatRes.ok) {
      const chatData = await chatRes.json();
      const rawMsg = chatData.choices?.[0]?.message;
      const text = rawMsg?.content || rawMsg?.reasoning || rawMsg?.reasoning_content || "";
      if (text && text.trim().length > 0) {
        resultText = text;
        break;
      }
      console.warn(`Groq model ${currentModel} returned empty content. Failing over to next candidate...`);
      modelIndex++;
      chatRetries++;
      await new Promise(resolve => setTimeout(resolve, 300));
      continue;
    }

    const errorText = await chatRes.text();
    const isRateLimit = chatRes.status === 429 || chatRes.status === 413 || errorText.includes("rate_limit") || errorText.includes("429") || errorText.includes("limit reached") || errorText.includes("Limit");
    
    if (isRateLimit && chatRetries < maxChatRetries) {
      chatRetries++;
      modelIndex++;
      const nextModel = candidateModels[modelIndex % candidateModels.length];
      console.warn(`Groq model ${currentModel} rate-limited. Instantly failing over to ${nextModel}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }

    console.error(`Groq Chat Error with ${currentModel}:`, errorText);
    modelIndex++;
    chatRetries++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!resultText || resultText.trim().length === 0) {
    throw new MeetingAnalysisError('EMPTY_RESPONSE', 'Empty response from Groq LLM.');
  }

  let parsed: any = null;

  try {
    let jsonText = resultText.trim();
    // Remove markdown code fences if present (e.g. ```json ... ```)
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Extract JSON block if the model output contains reasoning or conversational prefixes
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    try {
      parsed = JSON.parse(jsonText);
    } catch (firstErr) {
      // Fix common LLM JSON syntax quirks: trailing commas, unescaped control chars
      const sanitized = jsonText
        .replace(/,\s*([\}\]])/g, '$1')
        .replace(/[\u0000-\u001F]+/g, ' ');
      parsed = JSON.parse(sanitized);
    }
  } catch (parseError) {
    console.warn("Groq LLM output was not strict JSON. Applying intelligent text extraction fallback:", resultText);
    const lines = resultText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const bullets = lines.filter((l: string) => l.startsWith('-') || l.startsWith('*') || l.startsWith('•')).map((l: string) => l.replace(/^[-*•]\s*/, ''));
    const nonBullets = lines.filter((l: string) => !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('•') && !l.startsWith('```'));
    
    parsed = {
      summary: nonBullets.slice(0, 3).join(' ') || (language === 'portuguese' ? "Resumo gerado com base na transcrição." : "Summary generated from transcript."),
      highlights: bullets.length > 0 ? bullets : nonBullets.slice(3, 8),
      keyDecisions: [],
      nextActions: [],
      speakers: []
    };
  }

  // Construct the transcript by combining Whisper segments with LLM attributed speakers
  const transcript = formattedSegments.map((s: any, idx: number) => {
    const speakerName = parsed.speakers && parsed.speakers[idx] 
      ? parsed.speakers[idx] 
      : (isQuickDraft ? (language === 'portuguese' ? 'Utilizador' : 'User') : `Speaker ${idx + 1}`);
    return {
      speaker: speakerName,
      text: s.text,
      timestamp: s.timestamp
    };
  });

  const normalizedNextActions = (parsed.nextActions || []).map((na: any) => {
    if (typeof na === 'string') {
      return { task: na, assignee: language === 'portuguese' ? 'Equipa' : 'Team', dueDate: 'TBD' };
    }
    return {
      task: na.task || na.description || String(na),
      assignee: na.assignee || na.owner || (language === 'portuguese' ? 'Equipa' : 'Team'),
      dueDate: na.dueDate || na.deadline || 'TBD'
    };
  });

  const report: MeetingReport = {
    summary: parsed.summary || "",
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : (parsed.highlights ? [String(parsed.highlights)] : []),
    keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : (parsed.keyDecisions ? [String(parsed.keyDecisions)] : []),
    nextActions: normalizedNextActions,
    transcript,
    isQuickDraft,
    quickDraft: isQuickDraft ? {
      formattedNotes: parsed.formattedNotes || "",
      taskList: Array.isArray(parsed.taskList) ? parsed.taskList : [],
      emailDraft: parsed.emailDraft || ""
    } : undefined
  };

  return report;
}
