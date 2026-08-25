import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { askGemini, classifyQueryIntent } from './geminiBackend.js';
import { authenticateRequest } from './auth.js';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const requestId = req.body?.requestId || req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);

  // 1. Authenticate Request
  const authResult = await authenticateRequest(req);
  if ('error' in authResult) {
    return res.status(authResult.status).json({ error: authResult.error, requestId });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  let serviceSupabase: any = null;

  if (supabaseUrl && supabaseServiceKey) {
    serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  const startTime = Date.now();
  let classification: any = { intent: 'STRUCTURED_QUERY', confidence: 1.0 };
  let ftsLatencyMs = 0;

  try {
    const { query, report, historyItems, chatHistory, language } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query', requestId });
    }

    classification = classifyQueryIntent(query);
    let relevantHistory = Array.isArray(historyItems) ? historyItems : [];

    // 2. FTS Archive Search via Service Role
    if (serviceSupabase && (classification.intent === 'HISTORICAL_QUERY' || !report || relevantHistory.length === 0)) {
      const ftsStart = Date.now();
      try {
        const { data: searchResults, error: searchError } = await serviceSupabase.rpc('search_user_meetings', {
          p_user_id: authResult.user.id,
          p_search_query: query,
          p_limit: 3
        });

        if (!searchError && Array.isArray(searchResults) && searchResults.length > 0) {
          relevantHistory = searchResults;
        }
      } catch (ftsErr) {
        console.warn('Could not execute search_user_meetings FTS RPC:', ftsErr);
      } finally {
        ftsLatencyMs = Date.now() - ftsStart;
      }
    }

    // 3. Execute Resilient Multi-Turn AskGemini with Telemetry
    const chatResult = await askGemini(
      query,
      report || null,
      relevantHistory,
      chatHistory || [],
      language || 'portuguese',
      requestId
    );

    const totalLatencyMs = Date.now() - startTime;

    // 4. Asynchronous Observability Logging (Anonymized: Never store raw text or questions)
    if (serviceSupabase) {
      serviceSupabase.from('gemini_usage_logs').insert({
        request_id: requestId,
        user_id: authResult.user.id,
        meeting_id: report?.id || null,
        query_type: 'ask_gemini',
        intent: classification.intent,
        context_size: chatResult.contextSize,
        tokens_input: chatResult.tokensInput,
        tokens_output: chatResult.tokensOutput,
        primary_model: chatResult.primaryModel,
        final_model: chatResult.finalModel,
        model_used: chatResult.finalModel,
        is_fallback: chatResult.isFallback,
        fallback_reason: chatResult.fallbackReason,
        error_type: chatResult.errorType,
        pipeline_version: 'phase6',
        latency_ms: totalLatencyMs,
        fts_latency_ms: ftsLatencyMs,
        gemini_latency_ms: chatResult.geminiLatencyMs,
        has_transcript: chatResult.hasTranscript
      }).then(({ error: logErr }: any) => {
        if (logErr) {
          console.warn('[Observability] Could not write to gemini_usage_logs:', logErr.message);
        }
      }).catch((e: any) => {
        console.warn('[Observability] Logging error:', e?.message || e);
      });
    }

    return res.status(200).json({ 
      requestId,
      response: chatResult.response,
      intent: classification.intent,
      confidence: classification.confidence,
      metrics: {
        latency_ms: totalLatencyMs,
        fts_latency_ms: ftsLatencyMs,
        gemini_latency_ms: chatResult.geminiLatencyMs,
        tokens_input: chatResult.tokensInput,
        tokens_output: chatResult.tokensOutput,
        primary_model: chatResult.primaryModel,
        final_model: chatResult.finalModel,
        model_used: chatResult.finalModel,
        is_fallback: chatResult.isFallback,
        fallback_reason: chatResult.fallbackReason
      }
    });
  } catch (error: any) {
    const totalLatencyMs = Date.now() - startTime;
    console.error('Error in Vercel Serverless function /api/chat:', error);

    if (serviceSupabase) {
      serviceSupabase.from('gemini_usage_logs').insert({
        request_id: requestId,
        user_id: authResult.user.id,
        query_type: 'ask_gemini',
        intent: classification.intent,
        error_type: error.message?.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN',
        pipeline_version: 'phase6',
        latency_ms: totalLatencyMs,
        fts_latency_ms: ftsLatencyMs,
        is_fallback: false
      }).catch(() => {});
    }

    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      requestId 
    });
  }
}
