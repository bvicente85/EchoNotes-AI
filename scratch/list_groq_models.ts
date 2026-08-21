import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("No Groq API key found.");
    return;
  }
  
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${groqApiKey}`
      }
    });
    
    const data = await res.json();
    console.log("Available Groq Models:");
    console.log(JSON.stringify(data.data.map((m: any) => m.id), null, 2));
  } catch (err) {
    console.error("Failed to fetch Groq models:", err);
  }
}

run();
