import fetch from 'node-fetch';

async function run() {
  console.log("Calling production analyze API...");
  
  // Generate 1 second of silent WAV base64
  const sampleRate = 8000;
  const numChannels = 1;
  const bytesPerSample = 2;
  const audioDataLength = sampleRate * numChannels * bytesPerSample * 1;
  const wavBuffer = Buffer.alloc(44 + audioDataLength);
  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + audioDataLength, 4);
  wavBuffer.write("WAVE", 8);
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  wavBuffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  wavBuffer.writeUInt16LE(bytesPerSample * 8, 34);
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(audioDataLength, 40);
  
  const mockAudioBase64 = wavBuffer.toString('base64');
  
  try {
    const res = await fetch("https://suma-ai-nine.vercel.app/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audioBase64: mockAudioBase64,
        mimeType: "audio/wav",
        detailLevel: "detailed",
        language: "portuguese",
        optimizeLowVolume: false,
        expectedSpeakers: ["Ana", "Bruno"],
        isQuickDraft: false,
        manualNotes: "",
        template: "standard",
        customTerms: "",
        aiModel: "groq-llama-3.3"
      })
    });
    
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
