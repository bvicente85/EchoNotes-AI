async function run() {
  console.log("Calling live Vercel /api/analyze...");
  
  const mockAudioBase64 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA"; // 44 bytes WAV file of silence
  const mimeType = "audio/wav";
  
  try {
    const response = await fetch("https://suma-ai-nine.vercel.app/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audioBase64: mockAudioBase64,
        mimeType,
        detailLevel: "detailed",
        language: "portuguese",
        optimizeLowVolume: false,
        expectedSpeakers: [],
        isQuickDraft: false
      })
    });
    
    console.log("Response status:", response.status);
    const text = await response.text();
    console.log("Response body snippet:", text.slice(0, 500));
  } catch (err: any) {
    console.error("Fetch failed:", err);
  }
}

run();
