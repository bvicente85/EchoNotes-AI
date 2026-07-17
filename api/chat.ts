import { askGemini } from './geminiBackend.js';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { query, report, historyItems, chatHistory, language } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    const responseText = await askGemini(
      query,
      report,
      historyItems,
      chatHistory,
      language
    );

    return res.status(200).json({ response: responseText });
  } catch (error: any) {
    console.error('Error in Vercel Serverless function /api/chat:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
