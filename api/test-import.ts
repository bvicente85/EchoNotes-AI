export default async function handler(req: any, res: any) {
  try {
    const backend = await import('./geminiBackend');
    return res.status(200).json({ success: true, keys: Object.keys(backend) });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Error importing geminiBackend',
      stack: error.stack,
      code: error.code
    });
  }
}
