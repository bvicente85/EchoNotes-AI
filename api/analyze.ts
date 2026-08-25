import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateMeetingReport } from './geminiBackend.js';
import { authenticateRequest } from './auth.js';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export function computeRequestFingerprint(audioBuffer: Buffer, rawOptions: any): { audioHash: string; requestFingerprint: string } {
  const audioHash = crypto.createHash('sha256').update(audioBuffer).digest('hex');

  const canonicalObj = {
    audioHash,
    customGuidelines: (rawOptions.customGuidelines || '').trim(),
    customTerms: (rawOptions.customTerms || '').trim().toLowerCase(),
    detailLevel: rawOptions.detailLevel === 'concise' ? 'concise' : 'detailed',
    expectedSpeakers: (Array.isArray(rawOptions.expectedSpeakers) 
      ? rawOptions.expectedSpeakers 
      : typeof rawOptions.expectedSpeakers === 'string' 
        ? rawOptions.expectedSpeakers.split(',') 
        : [])
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort(),
    isQuickDraft: Boolean(rawOptions.isQuickDraft),
    language: (rawOptions.language || 'portuguese').trim().toLowerCase(),
    manualNotes: (rawOptions.manualNotes || '').trim(),
    optimizeLowVolume: Boolean(rawOptions.optimizeLowVolume),
    template: (rawOptions.template || 'standard').trim().toLowerCase(),
    tone: (rawOptions.meetingTone || rawOptions.tone || 'professional').trim().toLowerCase(),
  };

  const canonicalString = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
  const requestFingerprint = crypto.createHash('sha256').update(canonicalString).digest('hex');

  return { audioHash, requestFingerprint };
}

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 1. Authenticate Request
  const authResult = await authenticateRequest(req);
  if ('error' in authResult) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  let activeJobId: string | null = null;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY missing in backend environment.');
    return res.status(500).json({ error: 'Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is required' });
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
      meetingTone, 
      tone,
      customGuidelines 
    } = req.body;

    const chosenTone = meetingTone || tone || 'professional';

    let finalBase64 = audioBase64;
    let audioBuffer: Buffer | null = null;

    if (audioUrl) {
      console.log('Downloading audio from storage...');
      const downloadRes = await fetch(audioUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download audio from storage: status ${downloadRes.status}`);
      }
      const arrayBuffer = await downloadRes.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      finalBase64 = audioBuffer.toString('base64');
    } else if (audioBase64) {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    }

    const validMimeType = mimeType || 'audio/webm';

    if (!finalBase64 || !audioBuffer) {
      return res.status(400).json({ error: 'Missing required parameters: audioBase64 or audioUrl' });
    }

    // 2. Compute Deterministic Request Fingerprint
    const { audioHash, requestFingerprint } = computeRequestFingerprint(audioBuffer, req.body);

    // 3. Claim Processing Job via Service Role
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: claimData, error: claimError } = await serviceSupabase.rpc('claim_processing_job', {
          p_user_id: authResult.user.id,
          p_request_fingerprint: requestFingerprint,
          p_audio_hash: audioHash
        });

        if (!claimError && Array.isArray(claimData) && claimData.length > 0) {
          const claim = claimData[0];
          activeJobId = claim.job_id;

          if (claim.action_taken === 'CACHE_HIT' && claim.meeting_id) {
            const { data: meeting } = await serviceSupabase
              .from('meetings')
              .select('report')
              .eq('id', claim.meeting_id)
              .single();

            if (meeting?.report) {
              return res.status(200).json(meeting.report);
            }
          }

          if (claim.action_taken === 'ALREADY_IN_PROGRESS') {
            return res.status(409).json({
              error: 'Analysis already in progress for this audio and configuration',
              jobId: claim.job_id,
              status: 'processing'
            });
          }
        }
      } catch (rpcErr) {
        console.warn('Could not execute claim_processing_job RPC:', rpcErr);
      }
    }

    // 4. Generate Meeting Report via Gemini
    const report = await generateMeetingReport(
      finalBase64,
      validMimeType,
      detailLevel,
      language,
      optimizeLowVolume,
      expectedSpeakers,
      isQuickDraft,
      manualNotes,
      template,
      customTerms,
      chosenTone,
      customGuidelines
    );

    // 5. Update Job Status to Completed
    if (activeJobId && supabaseUrl && supabaseServiceKey) {
      try {
        const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
        await serviceSupabase
          .from('processing_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', activeJobId);
      } catch (updErr) {
        console.error('Failed to mark processing job completed:', updErr);
      }
    }

    return res.status(200).json(report);
  } catch (error: any) {
    console.error('Error in Vercel Serverless function /api/analyze:', error);

    // Mark Job as Failed
    if (activeJobId && supabaseUrl && supabaseServiceKey) {
      try {
        const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
        await serviceSupabase
          .from('processing_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error?.message || 'Processing failed'
          })
          .eq('id', activeJobId);
      } catch (failErr) {
        console.error('Failed to mark processing job failed:', failErr);
      }
    }

    // Return structured error
    return res.status(error.type === 'CONFIG_ERROR' ? 503 : 500).json({ 
      error: error.message || 'Internal Server Error',
      type: error.type || 'SERVER_ERROR'
    });
  }
}
