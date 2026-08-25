import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { GoogleGenAI } from '@google/genai';
import { 
  PRIMARY_GEMINI_MODEL, 
  generateMeetingReport 
} from '../api/geminiBackend';

// Helper to synthesize a valid WAV buffer of exact target size in MB
function createSyntheticWavOfSizeMB(targetSizeMB: number): Buffer {
  const targetBytes = Math.round(targetSizeMB * 1024 * 1024);
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8; // 2 bytes per sample
  const dataSize = targetBytes - 44;
  const numSamples = Math.floor(dataSize / 2);

  const buffer = Buffer.alloc(targetBytes);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(targetBytes - 8, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Low volume 440Hz tone
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 2000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  return buffer;
}

async function runFilesApiValidation() {
  console.log("==================================================================");
  console.log("  FASE 4E: VALIDAÇÃO REAL DE ÁUDIO LONGO E FILES API (>15MB)");
  console.log("==================================================================\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY missing!");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // TEST: Generate 16.0 MB Audio Buffer to trigger Files API threshold (>15MB)
  const targetMB = 15.5;
  console.log(`1. Generating synthetic test audio of ${targetMB} MB (> 15MB threshold)...`);
  const startPrep = Date.now();
  const largeAudioBuffer = createSyntheticWavOfSizeMB(targetMB);
  const prepTime = Date.now() - startPrep;
  console.log(`   Buffer generated in ${prepTime}ms | Size: ${(largeAudioBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

  // Direct Files API Upload & Delete verification
  console.log("\n2. Testing Direct ai.files.upload() & ai.files.delete()...");
  const startUpload = Date.now();
  const fileObj = new File([largeAudioBuffer], `test_audio_${Date.now()}.wav`, { type: 'audio/wav' });
  
  let uploadResult: any = null;
  try {
    uploadResult = await ai.files.upload({ file: fileObj });
    const uploadDuration = Date.now() - startUpload;
    console.log(`   ✅ Files API Upload Succeeded in ${uploadDuration}ms!`);
    console.log(`   URI: ${uploadResult.uri}`);
    console.log(`   Name: ${uploadResult.name}`);
    console.log(`   MimeType: ${uploadResult.mimeType}`);
    console.log(`   State: ${uploadResult.state}`);

    // Verify cleanup
    console.log("\n3. Testing Files API Immediate Cleanup (ai.files.delete)...");
    const startDelete = Date.now();
    await ai.files.delete({ name: uploadResult.name });
    const deleteDuration = Date.now() - startDelete;
    console.log(`   ✅ Files API File Deleted in ${deleteDuration}ms!`);
  } catch (err: any) {
    console.error("   ❌ Files API Upload/Delete Failed:", err.message);
  }

  // End-to-end Pipeline Verification with generateMeetingReport
  console.log("\n4. Testing Full Pipeline with Files API (>15MB via generateMeetingReport)...");
  const base64Audio = largeAudioBuffer.toString('base64');
  const startPipeline = Date.now();

  try {
    const report = await generateMeetingReport(
      base64Audio,
      'audio/wav',
      'concise',
      'portuguese',
      false,
      ['Ana', 'Bruno'],
      false,
      undefined,
      'standard',
      undefined,
      PRIMARY_GEMINI_MODEL
    );
    const totalPipelineDuration = Date.now() - startPipeline;
    console.log(`   ✅ End-to-End Pipeline Succeeded in ${totalPipelineDuration}ms!`);
    console.log(`   Report summary: "${report.summary?.slice(0, 120)}..."`);
    console.log(`   Decisions count: ${report.keyDecisions?.length}, Highlights count: ${report.highlights?.length}`);
  } catch (err: any) {
    console.error("   ❌ End-to-End Pipeline Failed:", err.message);
  }

  console.log("\n==================================================================");
  console.log("  FILES API BENCHMARK COMPLETED");
  console.log("==================================================================");
}

runFilesApiValidation().catch(console.error);
