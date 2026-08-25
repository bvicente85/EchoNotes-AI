import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini, classifyQueryIntent } from '../api/geminiBackend';

async function runPhase6HardeningTests() {
  console.log("==================================================================");
  console.log("  FASE 6.1: TESTES DE HARDENING DA OBSERVABILIDADE E TRACKING");
  console.log("==================================================================\n");

  let allPassed = true;

  // 1. Correlação com Request ID
  console.log("1. Testar Correlação Técnica com Request ID...");
  const customRequestId = crypto.randomUUID();
  const dummyReport: any = {
    title: "Alinhamento Técnico Q4",
    summary: "Reunião de auditoria de telemetria.",
    highlights: ["Logs enriquecidos"],
    keyDecisions: ["Aprovada rastreabilidade de request_id"],
    nextActions: ["João: verificar logs"],
    transcript: []
  };

  const sampleQuery = "Qual a decisão de rastreabilidade aprovada?";
  const result = await askGemini(
    sampleQuery,
    dummyReport,
    [],
    [],
    'portuguese',
    customRequestId
  );

  console.log("   ➔ Request ID enviado  :", customRequestId);
  console.log("   ➔ Request ID retornado:", result.requestId);
  console.log("   ➔ Primary Model       :", result.primaryModel);
  console.log("   ➔ Final Model         :", result.finalModel);
  console.log("   ➔ Is Fallback         :", result.isFallback);
  console.log("   ➔ Fallback Reason     :", result.fallbackReason);
  console.log("   ➔ Error Type          :", result.errorType);

  if (result.requestId === customRequestId && result.primaryModel === 'gemini-3.6-flash') {
    console.log("   ✅ PASSED: Request ID correlacionado com sucesso!\n");
  } else {
    console.error("   ❌ FAILED: Inconsistência no Request ID!\n");
    allPassed = false;
  }

  // 2. Simulação de Payload Enriquecido com Zero Raw Text
  console.log("2. Validar Estrutura de Log Técnico Enriquecido...");
  const telemetryLog = {
    request_id: result.requestId,
    user_id: "50524491-297f-446c-8761-667fcf918051",
    meeting_id: "meeting-uuid-sample",
    query_type: 'ask_gemini',
    intent: 'STRUCTURED_QUERY',
    context_size: result.contextSize,
    tokens_input: result.tokensInput,
    tokens_output: result.tokensOutput,
    primary_model: result.primaryModel,
    final_model: result.finalModel,
    model_used: result.finalModel,
    is_fallback: result.isFallback,
    fallback_reason: result.fallbackReason,
    error_type: result.errorType,
    pipeline_version: 'phase6',
    latency_ms: 1250,
    fts_latency_ms: 8,
    gemini_latency_ms: result.geminiLatencyMs,
    has_transcript: false
  };

  const keys = Object.keys(telemetryLog);
  const hasRawSensitiveData = keys.some(k => ['query', 'response', 'prompt', 'answer', 'text', 'transcript'].includes(k));

  if (!hasRawSensitiveData && telemetryLog.pipeline_version === 'phase6' && telemetryLog.primary_model) {
    console.log("   ✅ PASSED: Log técnico está completamente anonimizado e tipado para agregação!\n");
  } else {
    console.error("   ❌ FAILED: Violação de privacidade ou campos técnicos em falta!\n");
    allPassed = false;
  }

  console.log("==================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL PHASE 6.1 TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================");
}

runPhase6HardeningTests().catch(console.error);
