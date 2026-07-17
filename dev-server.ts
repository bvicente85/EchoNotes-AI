import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import analyzeHandler from './api/analyze';
import chatHandler from './api/chat';
import testEnvHandler from './api/test-env';

const app = express();
const PORT = process.env.PORT || 3001;

// Custom zero-dependency CORS middleware to avoid importing the 'cors' package
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Parse large payloads (audio base64 files can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper to mock Vercel req/res for Express
const mockVercel = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    // Vercel Request shape helper
    const vercelReq = {
      method: req.method,
      body: req.body,
      query: req.query,
      headers: req.headers
    };

    // Vercel Response shape helper
    const vercelRes = {
      statusCode: 200,
      headers: {} as Record<string, string[] | string | undefined>,
      setHeader(name: string, value: string | string[]) {
        this.headers[name] = value;
        res.setHeader(name, value);
      },
      status(code: number) {
        this.statusCode = code;
        res.status(code);
        return this;
      },
      json(data: any) {
        res.json(data);
        return this;
      },
      send(data: any) {
        res.send(data);
        return this;
      }
    };

    try {
      await handler(vercelReq, vercelRes);
    } catch (err) {
      console.error("Local Dev Server Handler Exception:", err);
      res.status(500).json({ error: "Internal Local Dev Server Error" });
    }
  };
};

// Expose Vercel routes as local Express routes
app.post('/api/analyze', mockVercel(analyzeHandler));
app.post('/api/chat', mockVercel(chatHandler));
app.get('/api/test-env', mockVercel(testEnvHandler));

app.listen(PORT, () => {
  console.log(`\n🚀 Secure Gemini API Dev Server started on http://localhost:${PORT}`);
  console.log(`🔑 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'CONFIGURED ✅' : 'NOT FOUND ❌'}\n`);
});
