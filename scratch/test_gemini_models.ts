import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No Gemini API key found.");
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  
  console.log(`\nTesting Gemini model: ${modelName}...`);
  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ text: "Hello! Tell me your name." }]
    });
    console.log(`Success: ${res.text?.trim()}`);
  } catch (err: any) {
    console.error(`Failed for ${modelName}:`, err.message || err);
  }
}

async function run() {
  await testModel("gemini-3.6-flash");
  await testModel("gemini-3.5-flash");
  await testModel("gemini-3.5-flash-lite");
  await testModel("gemini-2.5-pro");
}

run();
