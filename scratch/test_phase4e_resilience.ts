import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { 
  PRIMARY_GEMINI_MODEL, 
  FALLBACK_GEMINI_MODEL, 
  MAX_GEMINI_CALLS_PER_JOB, 
  calculateGeminiTimeout, 
  classifyGeminiError,
  MeetingAnalysisError 
} from '../api/geminiBackend';

async function runTests() {
  console.log("==================================================================");
  console.log("  FASE 4E: TEST SUITE FOR GEMINI RESILIENCE & ERROR CLASSIFICATION");
  console.log("==================================================================\n");

  let allPassed = true;

  // 1. Model Configuration
  console.log("1. Checking Model Selection & Max Calls Limit...");
  console.log("   Primary Model:", PRIMARY_GEMINI_MODEL);
  console.log("   Fallback Model:", FALLBACK_GEMINI_MODEL);
  console.log("   Max Calls Limit:", MAX_GEMINI_CALLS_PER_JOB);

  if (PRIMARY_GEMINI_MODEL === 'gemini-3.6-flash' && FALLBACK_GEMINI_MODEL === 'gemini-3.5-flash' && MAX_GEMINI_CALLS_PER_JOB === 2) {
    console.log("   ✅ PASSED: Models & Limit correctly configured (Max 2 calls)!\n");
  } else {
    console.error("   ❌ FAILED: Model configuration incorrect!\n");
    allPassed = false;
  }

  // 2. Timeout Calculations
  console.log("2. Testing Adaptive Timeout Calculations...");
  const t5min = calculateGeminiTimeout(300, false); // 5 min audio, inline
  const t60min = calculateGeminiTimeout(3600, true); // 60 min audio, files API
  console.log("   5min Inline Audio Timeout:", t5min / 1000, "s");
  console.log("   60min Files API Audio Timeout:", t60min / 1000, "s");

  if (t5min >= 45000 && t60min <= 210000) {
    console.log("   ✅ PASSED: Timeout is adaptive, respects floor (45s) and Vercel ceiling (210s)!\n");
  } else {
    console.error("   ❌ FAILED: Timeout out of expected bounds!\n");
    allPassed = false;
  }

  // 3. Error Classification: Permanent Errors (400, 401, 403)
  console.log("3. Testing Permanent Error Classification (400, 401, 403)...");
  const err400 = classifyGeminiError({ status: 400, message: 'Bad request format' });
  const err401 = classifyGeminiError({ status: 401, message: 'Invalid API key' });
  const err403 = classifyGeminiError({ status: 403, message: 'Permission denied' });

  if (!err400.isTransient && !err400.shouldRetry && !err400.shouldFallback &&
      !err401.isTransient && !err401.shouldRetry && !err401.shouldFallback &&
      !err403.isTransient && !err403.shouldRetry && !err403.shouldFallback) {
    console.log("   ✅ PASSED: Permanent errors result in 0 retries and 0 fallbacks (1 call only)!\n");
  } else {
    console.error("   ❌ FAILED: Permanent error was marked as retryable!\n");
    allPassed = false;
  }

  // 4. Error Classification: Transient Errors (500, 503, timeout)
  console.log("4. Testing Transient Error Classification (500, 503, Timeout)...");
  const err500 = classifyGeminiError({ status: 500, message: 'Internal error' });
  const err503 = classifyGeminiError({ status: 503, message: 'Service Unavailable / High demand' });
  const errTimeout = classifyGeminiError(new Error('Model gemini-3.6-flash request timed out locally'));

  if (err500.isTransient && err500.shouldFallback &&
      err503.isTransient && err503.shouldFallback &&
      errTimeout.isTransient && errTimeout.shouldFallback) {
    console.log("   ✅ PASSED: Transient errors trigger exactly 1 fallback attempt!\n");
  } else {
    console.error("   ❌ FAILED: Transient error classification incorrect!\n");
    allPassed = false;
  }

  // 5. Error Classification: 429 Rate Limiting
  console.log("5. Testing 429 Rate Limiting (Short vs Long Retry-After)...");
  const err429Short = classifyGeminiError({ status: 429, retryAfter: 3 });
  const err429Long = classifyGeminiError({ status: 429, retryAfter: 30 });

  if (err429Short.shouldRetry && err429Short.retryAfterMs === 3000 &&
      !err429Long.shouldRetry && !err429Long.shouldFallback) {
    console.log("   ✅ PASSED: 429 short window triggers backoff retry; 429 long window fails immediately!\n");
  } else {
    console.error("   ❌ FAILED: 429 rate limit classification incorrect!\n");
    allPassed = false;
  }

  console.log("==================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL RESILIENCE TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================");
}

runTests().catch(console.error);
