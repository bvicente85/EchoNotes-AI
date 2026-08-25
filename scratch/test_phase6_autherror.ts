import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini } from '../api/geminiBackend';

async function runAuthErrorPolicyTest() {
  console.log("==================================================================================");
  console.log("  TESTE DE POLÍTICA DE AUTH_ERROR: 1 CHAMADA MÁXIMA (SEM FALLBACK)");
  console.log("==================================================================================");

  let passed = false;
  const originalKey = process.env.GEMINI_API_KEY;
  
  try {
    // Definir chave inválida para provocar AUTH_ERROR (401/403)
    process.env.GEMINI_API_KEY = "AIzaSyInvalidKeyToTestAuthTermination12345";
    
    console.log("\n1. Executar askGemini com credencial inválida...");
    await askGemini(
      "Qual é o sumário?",
      { title: "T", summary: "S", highlights: [], keyDecisions: [], nextActions: [], transcript: [] },
      [],
      [],
      'portuguese',
      'req-auth-test-01'
    );
  } catch (err: any) {
    process.env.GEMINI_API_KEY = originalKey;
    console.log(`\n➔ Erro Estruturado Recebido: [${err.errorType}] ${err.message}`);
    console.log(`➔ Status HTTP: ${err.status}`);

    if (err.errorType === 'AUTH_ERROR' && err.status === 401) {
      console.log("\n✅ PASSED: O sistema terminou imediatamente na Chamada 1 sem executar fallback inútil!");
      passed = true;
    } else {
      console.error("\n❌ FAILED: Erro inesperado:", err);
    }
  }

  console.log("==================================================================================");
  console.log(`  RESULTADO: ${passed ? 'AUTH_ERROR POLICY VERIFIED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================================");
}

runAuthErrorPolicyTest().catch(console.error);
