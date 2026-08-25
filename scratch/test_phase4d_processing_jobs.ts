import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { computeRequestFingerprint } from '../api/analyze';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runTests() {
  console.log("==================================================================");
  console.log("  FASE 4D: TEST SUITE FOR PROCESSING JOBS & FINGERPRINTING");
  console.log("==================================================================\n");

  let allPassed = true;

  // Test 1: Canonicalization stability across shuffled options
  console.log("1. Testing Canonicalization Determinism (T-01)...");
  const dummyBuffer = Buffer.from("FAKE_AUDIO_STREAM_BINARY_DATA_TEST_12345");
  
  const config1 = {
    detailLevel: 'detailed',
    language: 'portuguese',
    expectedSpeakers: ['Ana Silva', 'Bruno Filipe'],
    tone: 'professional',
    template: 'standard'
  };

  const config2 = {
    template: 'standard',
    expectedSpeakers: ['Bruno Filipe', 'Ana Silva '], // inverted array order & trailing whitespace
    tone: 'PROFESSIONAL', // uppercase
    language: 'portuguese ', // trailing whitespace
    detailLevel: 'detailed'
  };

  const res1 = computeRequestFingerprint(dummyBuffer, config1);
  const res2 = computeRequestFingerprint(dummyBuffer, config2);

  console.log("   Config 1 Audio Hash:", res1.audioHash);
  console.log("   Config 1 Fingerprint:", res1.requestFingerprint);
  console.log("   Config 2 Fingerprint:", res2.requestFingerprint);

  if (res1.audioHash === res2.audioHash && res1.requestFingerprint === res2.requestFingerprint) {
    console.log("   ✅ PASSED: Shuffled/unnormalized inputs produce identical deterministic fingerprint!\n");
  } else {
    console.error("   ❌ FAILED: Fingerprints diverged on identical semantic inputs!\n");
    allPassed = false;
  }

  // Test 2: Different config on same audio produces different fingerprint (T-03)
  console.log("2. Testing Configuration Sensitivity (T-03)...");
  const configDifferentTone = { ...config1, tone: 'casual' };
  const resDiff = computeRequestFingerprint(dummyBuffer, configDifferentTone);
  console.log("   Different Tone Fingerprint:", resDiff.requestFingerprint);

  if (resDiff.audioHash === res1.audioHash && resDiff.requestFingerprint !== res1.requestFingerprint) {
    console.log("   ✅ PASSED: Changing tone produces different request_fingerprint while preserving audio_hash!\n");
  } else {
    console.error("   ❌ FAILED: Fingerprints collided across different configurations!\n");
    allPassed = false;
  }

  // Test 3: Validate regex formats
  console.log("3. Testing Hash Formats (64 hex characters)...");
  const hexRegex = /^[a-f0-9]{64}$/;
  if (hexRegex.test(res1.audioHash) && hexRegex.test(res1.requestFingerprint)) {
    console.log("   ✅ PASSED: Both hashes strictly conform to 64-character lowercase hexadecimal format!\n");
  } else {
    console.error("   ❌ FAILED: Hash format invalid!\n");
    allPassed = false;
  }

  console.log("==================================================================");
  console.log(`  RESULTADO: ${allPassed ? 'ALL FINGERPRINTING & INTEGRATION TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================");
}

runTests().catch(console.error);
