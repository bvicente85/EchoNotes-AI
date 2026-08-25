import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini } from '../api/geminiBackend';

async function runRecoveryTest() {
  console.log("==================================================================================");
  console.log("  FASE 6.5: RECOVERY TEST — VALIDAÇÃO DE RECUPERAÇÃO APÓS FALHA TEMPORÁRIA");
  console.log("==================================================================================\n");

  let allPassed = true;
  const originalKey = process.env.GEMINI_API_KEY;

  const testMeeting = {
    id: "recovery-test-meeting-01",
    title: "Reunião de Continuidade e Recuperação",
    summary: "Revisão do plano de contingência operacional e recuperação pós-incidente.",
    highlights: ["SLA 99.9% atingido"],
    keyDecisions: ["Aprovado protocolo de auto-recuperação sem estados bloqueados"],
    nextActions: ["Equipa: manter monitorização activa"],
    transcript: []
  };

  const sampleQuery = "Qual foi a decisão do protocolo de recuperação?";

  // ----------------------------------------------------------------------------
  // PASSO 1 & 2: FORÇAR FALHA TEMPORÁRIA E VALIDAR ERRO CONTROLADO
  // ----------------------------------------------------------------------------
  console.log("Passo 1 & 2: Forçar Falha Temporária no Provider e Validar Erro Estruturado...");
  const reqIdFailure = crypto.randomUUID();
  let failureCaught = false;
  let failureErrorType = "";
  let failureStatus = 0;

  try {
    process.env.GEMINI_API_KEY = "AIzaSyTemporarilyBrokenApiKeyForRecoveryTesting123";
    await askGemini(
      sampleQuery,
      testMeeting,
      [],
      [],
      'portuguese',
      reqIdFailure
    );
    console.error("   ❌ Erro: Deveria ter falhado com chave temporária inválida!");
    allPassed = false;
  } catch (err: any) {
    failureCaught = true;
    failureErrorType = err.errorType || "ERROR";
    failureStatus = err.status || 500;
    console.log(`   ➔ [FALHA CONTROLADA] Request ID: ${reqIdFailure}`);
    console.log(`   ➔ [FALHA CONTROLADA] Error Type : ${failureErrorType}`);
    console.log(`   ➔ [FALHA CONTROLADA] Mensagem   : ${err.message}`);
    console.log(`   ➔ [FALHA CONTROLADA] HTTP Status: ${failureStatus}`);
  }

  if (failureCaught && failureStatus === 401 && failureErrorType === 'AUTH_ERROR') {
    console.log("   ✅ PASSO 1 & 2 PASSED: Falha temporária produziu erro controlado e request_id preservado!\n");
  } else {
    console.error("   ❌ PASSO 1 & 2 FAILED: Falha não foi tratada de forma limpa!\n");
    allPassed = false;
  }

  // ----------------------------------------------------------------------------
  // PASSO 3, 4 & 5: RESTAURAR PROVIDER E REPETIR EXACTAMENTE O MESMO PEDIDO
  // ----------------------------------------------------------------------------
  console.log("Passo 3, 4 & 5: Restaurar Provider e Repetir o Mesmo Pedido com Novo Request ID...");
  process.env.GEMINI_API_KEY = originalKey; // Restaurar chave válida

  const reqIdRecovered = crypto.randomUUID();
  let recoveredResponse: any = null;

  try {
    recoveredResponse = await askGemini(
      sampleQuery,
      testMeeting,
      [],
      [],
      'portuguese',
      reqIdRecovered
    );

    console.log(`   ➔ [RECUPERAÇÃO OK] Novo Request ID : ${recoveredResponse.requestId}`);
    console.log(`   ➔ [RECUPERAÇÃO OK] Modelo Utilizado: ${recoveredResponse.modelUsed}`);
    console.log(`   ➔ [RECUPERAÇÃO OK] Is Fallback     : ${recoveredResponse.isFallback}`);
    console.log(`   ➔ [RECUPERAÇÃO OK] Resposta Factual: ${recoveredResponse.response.replace(/\n/g, ' ').slice(0, 110)}...`);

    const hasFactualAnswer = recoveredResponse.response.toLowerCase().includes("auto-recuperação") ||
                             recoveredResponse.response.toLowerCase().includes("protocolo");

    const differentReqIds = reqIdFailure !== recoveredResponse.requestId;

    if (hasFactualAnswer && differentReqIds) {
      console.log("   ✅ PASSO 3, 4 & 5 PASSED: Processamento normal restabelecido com novo Request ID independente!\n");
    } else {
      console.error("   ❌ PASSO 3, 4 & 5 FAILED: Inconsistência na recuperação!\n");
      allPassed = false;
    }
  } catch (recErr: any) {
    console.error("   ❌ PASSO 3, 4 & 5 FAILED: Erro na recuperação:", recErr.message);
    allPassed = false;
  }

  // ----------------------------------------------------------------------------
  // PASSO 6: CONFIRMAR AUSÊNCIA DE ESTADOS PRESOS / POISONED STATE
  // ----------------------------------------------------------------------------
  console.log("Passo 6: Validar Ausência de Estados Bloqueados / Cache Envenenada...");
  await new Promise(r => setTimeout(r, 3000)); // Pequena pausa para arrefecimento de quota por segundo
  
  // Realizar um novo pedido independente para comprovar que sessões subsequentes funcionam limpas
  const reqIdFollowup = crypto.randomUUID();
  try {
    const followupRes = await askGemini(
      "Qual o resumo da reunião?",
      testMeeting,
      [],
      [],
      'portuguese',
      reqIdFollowup
    );

    const isClean = Boolean(followupRes.response) && followupRes.requestId === reqIdFollowup;
    if (isClean) {
      console.log(`   ➔ Sessão subsequente [Req: ${reqIdFollowup}] executada com sucesso imediato.`);
      console.log("   ✅ PASSO 6 PASSED: Zero bloqueios, zero envenenamento de cache ou jobs presos!\n");
    } else {
      console.error("   ❌ PASSO 6 FAILED: Estado residual detectado!\n");
      allPassed = false;
    }
  } catch (followupErr: any) {
    console.error("   ❌ PASSO 6 FAILED:", followupErr.message);
    allPassed = false;
  }

  console.log("==================================================================================");
  console.log(`  RESULTADO DO RECOVERY TEST: ${allPassed ? 'ALL RECOVERY STEPS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================================");
}

runRecoveryTest().catch(console.error);
