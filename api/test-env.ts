export default async function handler(req: any, res: any) {
  try {
    const key = process.env.GEMINI_API_KEY;
    return res.status(200).json({
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyPrefix: key ? key.slice(0, 6) : 'none',
      nodeVersion: process.version,
      envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('PASSWORD') && !k.includes('KEY'))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
