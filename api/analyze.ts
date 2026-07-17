export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { generateMeetingReport } = await import('../src/services/geminiBackend');
    const { 
      audioBase64, 
      mimeType, 
      detailLevel, 
      language, 
      optimizeLowVolume, 
      expectedSpeakers, 
      isQuickDraft, 
      manualNotes, 
      template, 
      customTerms, 
      aiModel, 
      meetingTone, 
      customGuidelines 
    } = req.body;

    if (!audioBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing required parameters: audioBase64 or mimeType' });
    }

    const report = await generateMeetingReport(
      audioBase64,
      mimeType,
      detailLevel,
      language,
      optimizeLowVolume,
      expectedSpeakers,
      isQuickDraft,
      manualNotes,
      template,
      customTerms,
      aiModel,
      meetingTone,
      customGuidelines
    );

    return res.status(200).json(report);
  } catch (error: any) {
    console.error('Error in Vercel Serverless function /api/analyze:', error);
    // Return structured error
    return res.status(error.type === 'CONFIG_ERROR' ? 503 : 500).json({ 
      error: error.message || 'Internal Server Error',
      type: error.type || 'SERVER_ERROR'
    });
  }
}
