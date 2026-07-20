import { generateMeetingReport } from './geminiBackend.js';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { 
      audioBase64, 
      audioUrl,
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

    let finalBase64 = audioBase64;
    if (audioUrl) {
      console.log(`Downloading audio from URL: ${audioUrl}`);
      const downloadRes = await fetch(audioUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download audio from storage: status ${downloadRes.status}`);
      }
      const arrayBuffer = await downloadRes.arrayBuffer();
      finalBase64 = Buffer.from(arrayBuffer).toString('base64');
    }

    if (!finalBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing required parameters: audioBase64/audioUrl or mimeType' });
    }

    const report = await generateMeetingReport(
      finalBase64,
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
