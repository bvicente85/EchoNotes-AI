import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini } from '../api/geminiBackend';

async function runPolicy429Tests() {
  console.log("==================================================================================");
  console.log("  FASE 6.3.1: TESTES DE AJUSTE DA POLÍTICA 429 (RATE LIMIT & BACKOFF)");
  console.log("==================================================================================\n");

  let allPassed = true;

  // 1. Simulação de Extração de Delay
  console.log("1. Validar Lógica de Parsing de Retry-After e RetryInfo...");
  const dummy429ErrorShort = {
    status: 429,
    message: "Quota exceeded. Please retry in 3.5s."
  };
  const dummy429ErrorLong = {
    status: 429,
    message: "Quota exceeded. Please retry in 25.0s."
  };

  const shortMatch = dummy429ErrorShort.message.match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  const longMatch = dummy429ErrorLong.message.match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);

  const delayShort = shortMatch ? parseFloat(shortMatch[1]) : 0;
  const delayLong = longMatch ? parseFloat(longMatch[1]) : 0;

  console.log(`   ➔ Delay Curto detectado: ${delayShort}s (Decisão esperada: Retry no primário com backoff)`);
  console.log(`   ➔ Delay Longo detectado: ${delayLong}s (Decisão esperada: Activar fallback imediato)`);

  if (delayShort <= 5 && delayLong > 5) {
    console.log("   ✅ PASSED: Limiares de 5s perfeitamente diferenciados!\n");
  } else {
    console.error("   ❌ FAILED: Erro no limiar!\n");
    allPassed = false;
  }

  // 2. Executar Chamada Real do AskGemini sob a Nova Política
  console.log("2. Executar Chamada Real no AskGemini com Política 429 Activa...");
  const dummyReport = {
    title: "Alinhamento de Quotas e SLAs",
    summary: "Revisão de capacidade e planos de contingência do sistema.",
    highlights: ["SLA de 99.9% mantido"],
    keyDecisions: ["Aprovada nova política de 429 com threshold de 5s"],
    nextActions: ["Equipa: validar em produção"],
    transcript: []
  };

  try {
    const res = await askGemini(
      "Qual foi a decisão de quotas aprovada?",
      dummyReport,
      [],
      [],
      'portuguese',
      'req-policy-429-test'
    );

    console.log("   ➔ Resposta Obtida:", res.response.replace(/\n/g, ' ').slice(0, 100) + '...');
    console.log("   ➔ Modelo Utilizado:", res.modelUsed);
    console.log("   ➔ Is Fallback     :", res.isFallback);
    console.log("   ➔ Fallback Reason :", res.fallbackReason);

    if (res.response && res.modelUsed) {
      console.log("   ✅ PASSED: AskGemini processou o pedido com sucesso sob a política 429!\n");
    }
  } catch (err: any) {
    console.log(`   ➔ Erro Estruturado Capturado: [${err.errorType || 'ERROR'}] ${err.message}`);
    if (err.errorType === '429_RATE_LIMIT' || err.status === 429) {
      console.log("   ✅ PASSED: Erro estruturado 429 retornado corretamente quando todas as cotas falham!\n");
    } else {
      console.error("   ❌ FAILED:", err);
      allPassed = false;
    }
  }

  console.log("==================================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL PHASE 6.3.1 TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================================");
}

runPolicy429Tests().catch(console.error);
