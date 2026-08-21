import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testModel(modelName: string) {
  const groqApiKey = process.env.GROQ_API_KEY;
  console.log(`\nTesting model: ${modelName}...`);
  
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello and give a 1-sentence description of yourself." }
        ],
        temperature: 0.1
      })
    });
    
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      console.log(`Response: ${data.choices[0]?.message?.content}`);
    } else {
      console.log(`Error: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    console.error(`Failed to call ${modelName}:`, err.message || err);
  }
}

async function run() {
  await testModel("groq/compound");
  await testModel("groq/compound-mini");
  await testModel("qwen/qwen3.6-27b");
  await testModel("allam-2-7b");
}

run();
