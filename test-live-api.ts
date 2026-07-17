async function run() {
  console.log("Calling live Vercel /api/test-import...");
  
  try {
    const response = await fetch("https://suma-ai-nine.vercel.app/api/test-import");
    console.log("Response status:", response.status);
    const text = await response.text();
    console.log("Response body:", text);
  } catch (err: any) {
    console.error("Fetch failed:", err);
  }
}

run();
