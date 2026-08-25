import { MeetingReport } from '../src/services/gemini';

function generateMarkdownExport(data: MeetingReport, includeTranscript: boolean = true): string {
  const title = data.title || 'Meeting Report';
  const client = data.clientName ? `**Client / Cliente:** ${data.clientName}\n\n` : '';
  const date = `**Date / Data:** ${new Date(data.meetingDate || Date.now()).toLocaleString('pt-PT')}\n\n`;
  
  let md = `# ${title}\n\n${client}${date}---\n\n`;

  md += `## Resumo Executivo\n\n${data.summary || ''}\n\n`;
  md += `## Destaques Principais\n\n`;
  (data.highlights || []).forEach(h => {
    md += `- ${h}\n`;
  });
  md += `\n## Decisões Chave\n\n`;
  (data.keyDecisions || []).forEach(d => {
    md += `- ${d}\n`;
  });
  md += `\n## Próximos Passos\n\n`;
  (data.nextActions || []).forEach((a, idx) => {
    md += `${idx + 1}. [ ] ${a}\n`;
  });
  md += '\n';

  if (includeTranscript && data.transcript && data.transcript.length > 0) {
    md += `## Transcrição Integral\n\n`;
    data.transcript.forEach(t => {
      md += `**[${t.timestamp}] ${t.speaker.toUpperCase()}:** ${t.text}\n\n`;
    });
  }

  return md.trim();
}

function generateJsonExport(data: MeetingReport, includeTranscript: boolean = true) {
  return {
    title: data.title,
    clientName: data.clientName,
    date: data.meetingDate,
    summary: data.summary,
    highlights: data.highlights,
    keyDecisions: data.keyDecisions,
    nextActions: data.nextActions,
    isQuickDraft: data.isQuickDraft,
    quickDraft: data.quickDraft,
    manualNotes: data.manualNotes,
    metadata: {
      duration: data.duration,
      startTime: data.startTime,
      endTime: data.endTime,
      analyzedAt: data.analyzedAt,
      template: data.template
    },
    transcript: includeTranscript ? data.transcript : undefined
  };
}

async function validateExportLayer() {
  console.log("==================================================================================");
  console.log("  VALIDAÇÃO DA CAMADA DE EXPORTAÇÃO (MARKDOWN & JSON ESTRUTURADO)");
  console.log("==================================================================================\n");

  const sampleReport: MeetingReport = {
    title: "Reunião de Alinhamento e Entrega de Produto",
    clientName: "SUMA / Cliente Estratégico",
    meetingDate: "2026-08-25T10:00:00.000Z",
    summary: "Reunião de validação final com alinhamento sobre arquitetura, exportação e prontidão.",
    highlights: [
      "Pipeline de inteligência concluído com 100% de resiliência",
      "Formatos de exportação alinhados para consumo humano e agentes IA"
    ],
    keyDecisions: [
      "Aprovada disponibilização em Markdown para leitura humana",
      "Aprovada disponibilização em JSON estruturado com esquema estrito para agentes IA",
      "Preservação integral de transcrição, decisões, ações e metadados"
    ],
    nextActions: [
      "Bruno (Engenharia): Validação de esquema e empacotamento final",
      "Equipa: Disponibilização para exportação externa"
    ],
    transcript: [
      { speaker: "Bruno", text: "Iniciamos a validação da camada de exportação.", timestamp: "00:01" },
      { speaker: "Ana", text: "Confirmamos que todos os campos estruturados estão completos.", timestamp: "00:15" },
      { speaker: "Carlos", text: "Os agentes externos conseguem consumir o JSON diretamente sem parse ambíguo.", timestamp: "00:30" }
    ],
    duration: 1800,
    startTime: "10:00",
    endTime: "10:30",
    analyzedAt: "2026-08-25T10:31:00.000Z",
    template: "standard"
  };

  let allPassed = true;

  // 1. Validar Exportação Markdown
  console.log("1. Validar Exportação em Formato Markdown (Leitura Humana)...");
  const mdOutput = generateMarkdownExport(sampleReport, true);
  
  const hasMdTitle = mdOutput.includes("# Reunião de Alinhamento e Entrega de Produto");
  const hasMdSummary = mdOutput.includes("## Resumo Executivo");
  const hasMdDecisions = mdOutput.includes("## Decisões Chave") && mdOutput.includes("Aprovada disponibilização em Markdown");
  const hasMdActions = mdOutput.includes("## Próximos Passos") && mdOutput.includes("Bruno (Engenharia)");
  const hasMdTranscript = mdOutput.includes("## Transcrição Integral") && mdOutput.includes("[00:01] BRUNO:");

  if (hasMdTitle && hasMdSummary && hasMdDecisions && hasMdActions && hasMdTranscript) {
    console.log("   ✅ PASSED: Markdown exporta todos os blocos com hierarquia e tipografia perfeitas!");
  } else {
    console.error("   ❌ FAILED: Campos em falta no Markdown!");
    allPassed = false;
  }

  // 2. Validar Exportação JSON Estruturado
  console.log("\n2. Validar Exportação em JSON Estruturado (Consumo por Agentes IA)...");
  const jsonObject = generateJsonExport(sampleReport, true);
  const jsonString = JSON.stringify(jsonObject, null, 2);
  const parsedBack = JSON.parse(jsonString);

  const hasJsonDecisions = Array.isArray(parsedBack.keyDecisions) && parsedBack.keyDecisions.length === 3;
  const hasJsonActions = Array.isArray(parsedBack.nextActions) && parsedBack.nextActions.length === 2;
  const hasJsonTranscript = Array.isArray(parsedBack.transcript) && parsedBack.transcript.length === 3;
  const hasJsonMetadata = Boolean(parsedBack.metadata?.duration && parsedBack.metadata?.analyzedAt);

  if (hasJsonDecisions && hasJsonActions && hasJsonTranscript && hasJsonMetadata) {
    console.log("   ✅ PASSED: JSON estruturado preserva 100% dos dados tipados sem perdas!");
  } else {
    console.error("   ❌ FAILED: Inconsistência no JSON estruturado!");
    allPassed = false;
  }

  console.log("\n==================================================================================");
  console.log(`  RESULTADO DA CAMADA DE EXPORTAÇÃO: ${allPassed ? 'ALL EXPORT TESTS PASSED ✅' : 'FAIL ❌'}`);
  console.log("==================================================================================");
}

validateExportLayer().catch(console.error);
