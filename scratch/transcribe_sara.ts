import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generateMeetingReport } from '../api/geminiBackend';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const meetingsDir = path.resolve(process.cwd(), '../meetings/sara');
const artifactsDir = path.resolve('C:/Users/bruno/.gemini/antigravity/brain/7b3a4d69-4b5c-40ba-9405-99fe1a03b420');

async function run() {
  const filename = '1787154107438_backup.webm';
  const filePath = path.join(meetingsDir, filename);
  console.log(`\n==================================================`);
  console.log(`Processing: ${filename}`);
  console.log(`File path: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    return;
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const audioBase64 = fileBuffer.toString('base64');
  const mimeType = 'audio/webm'; // WebM audio files

  try {
    console.log(`Sending to Gemini API using gemini-3.6-flash (Portuguese)...`);
    
    const report = await generateMeetingReport(
      audioBase64,
      mimeType,
      'detailed',
      'portuguese',
      false, // optimizeLowVolume
      [], // expectedSpeakers
      false, // isQuickDraft
      undefined, // manualNotes
      'standard', // template
      undefined, // customTerms
      'gemini-3.6-flash' // modelOverride
    );
    
    console.log(`Generating markdown report for ${filename}...`);
    
    let mdContent = `# Relatório de Reunião: ${report.title || filename}\n\n`;
    
    if (report.clientName) {
      mdContent += `**Cliente:** ${report.clientName}\n`;
    }
    
    const meetingDateStr = report.meetingDate 
      ? new Date(report.meetingDate).toLocaleString('pt-PT')
      : new Date().toLocaleString('pt-PT');
    mdContent += `**Data da Reunião:** ${meetingDateStr}\n\n`;
    
    mdContent += `## Sumário Executivo\n${report.summary}\n\n`;
    
    mdContent += `## Destaques Principais\n`;
    if (report.highlights && report.highlights.length > 0) {
      report.highlights.forEach(h => {
        mdContent += `- ${h}\n`;
      });
    } else {
      mdContent += `*Nenhum destaque registado.*\n`;
    }
    mdContent += `\n`;
    
    mdContent += `## Decisões Chave\n`;
    if (report.keyDecisions && report.keyDecisions.length > 0) {
      report.keyDecisions.forEach(d => {
        mdContent += `- ${d}\n`;
      });
    } else {
      mdContent += `*Nenhuma decisão registada.*\n`;
    }
    mdContent += `\n`;
    
    mdContent += `## Próximos Passos (Ações)\n`;
    if (report.nextActions && report.nextActions.length > 0) {
      report.nextActions.forEach((a, index) => {
        mdContent += `${index + 1}. ${a}\n`;
      });
    } else {
      mdContent += `*Nenhuma ação planeada.*\n`;
    }
    mdContent += `\n`;
    
    mdContent += `## Transcrição Completa\n\n`;
    if (report.transcript && report.transcript.length > 0) {
      report.transcript.forEach(t => {
        mdContent += `**[${t.timestamp}] ${t.speaker}**\n${t.text}\n\n`;
      });
    } else {
      mdContent += `*Nenhuma transcrição disponível.*\n`;
    }
    
    // Save to meetings/sara directory
    const outputFilename = `${path.parse(filename).name}_report.md`;
    const outputPath = path.join(meetingsDir, outputFilename);
    fs.writeFileSync(outputPath, mdContent, 'utf-8');
    console.log(`Saved report to: ${outputPath}`);
    
    // Save to conversation artifacts directory
    if (fs.existsSync(artifactsDir)) {
      const artifactPath = path.join(artifactsDir, outputFilename);
      fs.writeFileSync(artifactPath, mdContent, 'utf-8');
      console.log(`Saved artifact to: ${artifactPath}`);
    }
    
    console.log("Transcription process finished successfully!");
  } catch (err: any) {
    console.error(`Failed to transcribe ${filename} with gemini-3.6-flash:`, err.message || err);
  }
}

run();
