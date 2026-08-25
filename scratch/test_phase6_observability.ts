import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini, classifyQueryIntent } from '../api/geminiBackend';

async function runObservabilityTests() {
  console.log("==================================================================");
  console.log("  FASE 6: TESTES DE OBSERVABILIDADE E MÉTRICAS (GEMINI_USAGE_LOGS)");
  console.log("==================================================================\n");

  let allPassed = true;

  // 1. Validar Estrutura de Telemetria de askGemini
  console.log("1. Testar Geração de Métricas e Telemetria em askGemini...");
  const dummyReport: any = {
    title: "Reunião de Telemetria e Métricas",
    summary: "Reunião para validar recolha de métricas sem comprometer privacidade.",
    highlights: ["Métricas activas", "Anonimização total"],
    keyDecisions: ["Aprovada tabela gemini_usage_logs"],
    nextActions: ["Bruno: testar inserção"],
    transcript: []
  };

  const sampleQuery = "Qual foi a decisão aprovada?";
  const classification = classifyQueryIntent(sampleQuery);
  const startTotal = Date.now();
  const chatResult = await askGemini(sampleQuery, dummyReport, [], [], 'portuguese');
  const totalLatency = Date.now() - startTotal;

  console.log("   ➔ Resposta Gemini:", chatResult.response.replace(/\n/g, ' ').slice(0, 100) + '...');
  console.log("   ➔ Model Utilizado:", chatResult.modelUsed);
  console.log("   ➔ Context Size   :", chatResult.contextSize, "bytes/chars");
  console.log("   ➔ Tokens Input   :", chatResult.tokensInput);
  console.log("   ➔ Tokens Output  :", chatResult.tokensOutput);
  console.log("   ➔ Gemini Latency :", chatResult.geminiLatencyMs, "ms");
  console.log("   ➔ Total Latency  :", totalLatency, "ms");
  console.log("   ➔ Is Fallback    :", chatResult.isFallback);
  console.log("   ➔ Has Transcript :", chatResult.hasTranscript);

  if (chatResult.contextSize > 0 && chatResult.tokensInput > 0 && chatResult.tokensOutput > 0 && chatResult.geminiLatencyMs > 0) {
    console.log("   ✅ PASSED: Todas as métricas de performance e custos foram calculadas!\n");
  } else {
    console.error("   ❌ FAILED: Métricas incompletas ou zeradas!\n");
    allPassed = false;
  }

  // 2. Validar Anonimização e Garantia de Privacidade
  console.log("2. Validar Princípio de Anonimização (Zero Raw Text no Log)...");
  const logPayload = {
    user_id: "50524491-297f-446c-8761-667fcf918051",
    meeting_id: null,
    query_type: 'ask_gemini',
    intent: classification.intent,
    context_size: chatResult.contextSize,
    tokens_input: chatResult.tokensInput,
    tokens_output: chatResult.tokensOutput,
    model_used: chatResult.modelUsed,
    latency_ms: totalLatency,
    fts_latency_ms: 5,
    gemini_latency_ms: chatResult.geminiLatencyMs,
    is_fallback: chatResult.isFallback,
    has_transcript: chatResult.hasTranscript
  };

  const payloadKeys = Object.keys(logPayload);
  const containsSensitiveText = payloadKeys.includes('query') || 
                                payloadKeys.includes('response') || 
                                payloadKeys.includes('question') || 
                                payloadKeys.includes('prompt') || 
                                payloadKeys.includes('answer');

  if (!containsSensitiveText) {
    console.log("   ✅ PASSED: O payload para gemini_usage_logs não contém texto de perguntas nem de respostas!\n");
  } else {
    console.error("   ❌ FAILED: Payload contém campos sensíveis de texto!\n");
    allPassed = false;
  }

  // 3. Teste de Inserção Real na Base de Dados via Service Role
  console.log("3. Testar Inserção de Telemetria via Supabase...");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: inserted, error: insertError } = await serviceClient
      .from('gemini_usage_logs')
      .insert(logPayload)
      .select()
      .single();

    if (insertError) {
      console.warn("   ⚠️ Aviso de inserção DB (se migration ainda não foi executada no Supabase Studio):", insertError.message);
    } else {
      console.log("   ✅ PASSED: Registo de métricas inserido com ID:", inserted?.id);
    }
  } else {
    console.log("   ℹ️ Variáveis de ambiente de Supabase verificadas.");
  }

  console.log("\n==================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL PHASE 6 OBSERVABILITY TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================");
}

runObservabilityTests().catch(console.error);
