import dotenv from 'dotenv';
import path from 'path';
import { generateMeetingReport } from './api/geminiBackend';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  console.log("Starting local Gemini backend test...");
  console.log("GEMINI_API_KEY is defined:", !!process.env.GEMINI_API_KEY);
  
  try {
    // Generate a tiny mock audio base64 (44 bytes WAV file of silence)
    const mockAudioBase64 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
    const mimeType = "audio/wav";
    
    console.log("Calling generateMeetingReport...");
    const report = await generateMeetingReport(
      mockAudioBase64,
      mimeType,
      'detailed',
      'portuguese',
      false,
      [],
      false
    );
    console.log("Success! Report title:", report.title);
  } catch (err: any) {
    console.error("Error occurred during local execution:");
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("Raw Error Object:", err);
  }
}

run();
