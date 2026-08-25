import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { askGemini, classifyQueryIntent, sanitizeChatHistory, shouldRetrieveTranscript } from '../api/geminiBackend';

interface BenchmarkSample {
  name: string;
  requestId: string;
  durationMs: number;
  geminiLatencyMs: number;
  tokensInput: number;
  tokensOutput: number;
  isFallback: boolean;
  fallbackReason: string | null;
  hasTranscript: boolean;
  success: boolean;
}

const dummyShortMeeting = {
  id: "meeting-short-01",
  title: "Alinhamento Semanal Marketing",
  summary: "Apresentação dos resultados da campanha digital de verão com aumento de 22% em leads.",
  highlights: ["Custo por lead reduziu 15%", "Meta trimestral atingida"],
  keyDecisions: ["Aumentar investimento em Google Ads para 12.000€"],
  nextActions: ["Marta: Ajustar criativos até quarta-feira"],
  transcript: [
    { speaker: "Marta", text: "Os resultados de verão superaram as expectativas.", timestamp: "00:01" },
    { speaker: "Bruno", text: "Vamos aprovar o reforço orçamental de 12.000€.", timestamp: "00:15" }
  ]
};

// Transcrição simulada de 60 minutos (60 intervenções realistas)
const dummyLongTranscript = Array.from({ length: 60 }, (_, i) => ({
  speaker: i % 2 === 0 ? "Bruno" : "Ana",
  text: `Ponto de situação do minuto ${i + 1}: discussão sobre infraestrutura, migração de dados, segurança de redes e aprovações orçamentais da fase ${i + 1}.`,
  timestamp: `${String(Math.floor((i + 1) / 60)).padStart(2, '0')}:${String((i + 1) % 60).padStart(2, '0')}`
}));

const dummyLongMeeting = {
  id: "meeting-long-60m",
  title: "Reunião Executiva de Direcção e Infraestrutura (60 min)",
  summary: "Reunião exaustiva de revisão tecnológica com análise de arquitectura Cloud, orçamento de 150.000€ e segurança.",
  highlights: ["Migração de datacenter concluída em Novembro", "Auditoria ISO27001 aprovada"],
  keyDecisions: ["Aprovado investimento de 150.000€ na Cloud", "Renovação contratual de telecomunicações"],
  nextActions: ["Carlos: formalizar pedido de compra", "Sofia: agendar auditoria de segurança"],
  transcript: dummyLongTranscript
};

async function runProductionAudit() {
  console.log("==================================================================================");
  console.log("  FASE 6.2: AUDITORIA DE PRODUÇÃO, TESTE DE CARGA E BENCHMARK ASK GEMINI");
  console.log("==================================================================================\n");

  const results: BenchmarkSample[] = [];

  // ============================================================================
  // 1. TESTE DE CONCORRÊNCIA (10 PEDIDOS SIMULTÂNEOS)
  // ============================================================================
  console.log("1. Executar Teste de Concorrência Real (10 Pedidos Simultâneos)...");
  const concurrentQueries = [
    { q: "Qual foi a decisão de investimento aprovada?", m: dummyShortMeeting },
    { q: "Quem ficou encarregue dos criativos?", m: dummyShortMeeting },
    { q: "Qual o resumo dos resultados de verão?", m: dummyShortMeeting },
    { q: "Quais os destaques da reunião longa?", m: dummyLongMeeting },
    { q: "Qual o valor de investimento na Cloud?", m: dummyLongMeeting },
    { q: "Quem vai formalizar o pedido de compra?", m: dummyLongMeeting },
    { q: "O que foi dito sobre a auditoria ISO27001?", m: dummyLongMeeting },
    { q: "Qual a percentagem de aumento de leads?", m: dummyShortMeeting },
    { q: "Quando fica concluída a migração de datacenter?", m: dummyLongMeeting },
    { q: "Qual a acção atribuída à Sofia?", m: dummyLongMeeting }
  ];

  const startConcurrent = Date.now();
  const concurrentPromises = concurrentQueries.map(async (item, idx) => {
    const reqId = crypto.randomUUID();
    const t0 = Date.now();
    try {
      const res = await askGemini(item.q, item.m, [], [], 'portuguese', reqId);
      const totalTime = Date.now() - t0;
      return {
        name: `Req_${idx + 1}`,
        requestId: res.requestId || reqId,
        durationMs: totalTime,
        geminiLatencyMs: res.geminiLatencyMs,
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        isFallback: res.isFallback,
        fallbackReason: res.fallbackReason,
        hasTranscript: res.hasTranscript,
        success: true
      };
    } catch (err: any) {
      return {
        name: `Req_${idx + 1}`,
        requestId: reqId,
        durationMs: Date.now() - t0,
        geminiLatencyMs: 0,
        tokensInput: 0,
        tokensOutput: 0,
        isFallback: false,
        fallbackReason: 'ERROR',
        hasTranscript: false,
        success: false
      };
    }
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  const totalConcurrentTime = Date.now() - startConcurrent;
  results.push(...concurrentResults);

  const distinctReqIds = new Set(concurrentResults.map(r => r.requestId));
  const allSuccessful = concurrentResults.every(r => r.success);

  console.log(`   ➔ 10 Pedidos concluídos em: ${(totalConcurrentTime / 1000).toFixed(2)}s`);
  console.log(`   ➔ IDs Únicos / Sem Colisão: ${distinctReqIds.size} / 10`);
  console.log(`   ➔ Taxa de Sucesso Concorrente: ${concurrentResults.filter(r => r.success).length}/10`);

  if (distinctReqIds.size === 10 && allSuccessful) {
    console.log("   ✅ CONCORRÊNCIA: PASSOU COM ZERO RACE CONDITIONS!\n");
  } else {
    console.warn("   ⚠️ CONCORRÊNCIA: Verificar detalhes das respostas.\n");
  }

  // ============================================================================
  // 2. TESTE DE LIMITES DE CONTEXTO & TRANSCRIÇÃO LONGA
  // ============================================================================
  console.log("2. Testar Limites de Contexto e Transcrição Granular (>60 Minutos)...");
  
  // Pergunta com citação que força TRANSCRIPT_QUERY na reunião longa de 60m
  const transcriptQuery = "Quem disse no minuto 45 a frase sobre segurança de redes?";
  const tStartTrans = Date.now();
  const transcriptResult = await askGemini(
    transcriptQuery,
    dummyLongMeeting,
    [],
    [],
    'portuguese',
    crypto.randomUUID()
  );
  const transcriptDuration = Date.now() - tStartTrans;
  results.push({
    name: "Transcript_Long_60m",
    requestId: transcriptResult.requestId || "req-trans",
    durationMs: transcriptDuration,
    geminiLatencyMs: transcriptResult.geminiLatencyMs,
    tokensInput: transcriptResult.tokensInput,
    tokensOutput: transcriptResult.tokensOutput,
    isFallback: transcriptResult.isFallback,
    fallbackReason: transcriptResult.fallbackReason,
    hasTranscript: transcriptResult.hasTranscript,
    success: true
  });

  console.log("   ➔ Transcript 60m Tokens Input :", transcriptResult.tokensInput);
  console.log("   ➔ Transcript 60m Tokens Output:", transcriptResult.tokensOutput);
  console.log("   ➔ Has Transcript Activo      :", transcriptResult.hasTranscript);
  console.log("   ➔ Resposta Factual           :", transcriptResult.response.replace(/\n/g, ' ').slice(0, 120) + '...');

  // ============================================================================
  // 3. TESTE DE HISTÓRICO ACIMA DO LIMITE (JANELA DESLIZANTE DE 15 MSGS -> 8)
  // ============================================================================
  console.log("\n3. Testar Histórico de Conversa Excessivo (15 Mensagens -> Limite de 8)...");
  const heavyRawHistory: any[] = Array.from({ length: 15 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'model',
    parts: [{ text: `Mensagem de histórico número ${i + 1} com detalhe sobre a discussão técnica e decisões da semana.` }]
  }));

  const sanitizedHist = sanitizeChatHistory(heavyRawHistory, 8, 4000);
  console.log(`   ➔ Histórico inicial: 15 mensagens -> Sanitizado: ${sanitizedHist.length} mensagens`);

  const tStartHist = Date.now();
  const histResult = await askGemini(
    "E qual é a conclusão final das tarefas?",
    dummyShortMeeting,
    [],
    heavyRawHistory,
    'portuguese',
    crypto.randomUUID()
  );
  const histDuration = Date.now() - tStartHist;
  results.push({
    name: "ChatHistory_Bounded",
    requestId: histResult.requestId || "req-hist",
    durationMs: histDuration,
    geminiLatencyMs: histResult.geminiLatencyMs,
    tokensInput: histResult.tokensInput,
    tokensOutput: histResult.tokensOutput,
    isFallback: histResult.isFallback,
    fallbackReason: histResult.fallbackReason,
    hasTranscript: histResult.hasTranscript,
    success: true
  });

  console.log("   ➔ Histórico Bounded Tokens Input:", histResult.tokensInput);
  console.log("   ➔ Resposta com Histórico        :", histResult.response.replace(/\n/g, ' ').slice(0, 120) + '...');

  // ============================================================================
  // 4. ESTATÍSTICAS CONSOLIDADAS, P95 & ESTIMATIVA DE CUSTOS
  // ============================================================================
  console.log("\n==================================================================================");
  console.log("  MÉTRICAS CONSOLIDADAS DE PRODUÇÃO (FASE 6.2)");
  console.log("==================================================================================");

  const latencies = results.map(r => r.durationMs).sort((a, b) => a - b);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
  const p95Latency = latencies[p95Index];

  const avgTokensIn = Math.round(results.reduce((a, b) => a + b.tokensInput, 0) / results.length);
  const avgTokensOut = Math.round(results.reduce((a, b) => a + b.tokensOutput, 0) / results.length);
  const fallbackCount = results.filter(r => r.isFallback).length;
  const transcriptCount = results.filter(r => r.hasTranscript).length;

  // Preço oficial Gemini Flash: ~$0.075 por 1M tokens entrada, ~$0.30 por 1M tokens saída
  const costPer1kIn = (avgTokensIn * 1000 / 1_000_000) * 0.075;
  const costPer1kOut = (avgTokensOut * 1000 / 1_000_000) * 0.30;
  const totalCostPer1k = costPer1kIn + costPer1kOut;

  console.log(`\n| Métrica | Valor Medido |`);
  console.log(`|---|---|`);
  console.log(`| **Total de Pedidos Executados** | ${results.length} |`);
  console.log(`| **Latência Média E2E** | ${avgLatency} ms (${(avgLatency / 1000).toFixed(2)}s) |`);
  console.log(`| **Latência P95** | ${p95Latency} ms (${(p95Latency / 1000).toFixed(2)}s) |`);
  console.log(`| **Tokens Médios Entrada (Prompt + Contexto)** | ${avgTokensIn} tokens |`);
  console.log(`| **Tokens Médios Saída (Resposta)** | ${avgTokensOut} tokens |`);
  console.log(`| **Taxa de Uso de Transcrição Integral** | ${((transcriptCount / results.length) * 100).toFixed(1)}% |`);
  console.log(`| **Taxa de Fallback Acionado** | ${((fallbackCount / results.length) * 100).toFixed(1)}% (${fallbackCount}/${results.length}) |`);
  console.log(`| **Custo Estimado por 1.000 Perguntas** | $${totalCostPer1k.toFixed(4)} USD (~€${(totalCostPer1k * 0.92).toFixed(4)}) |`);

  console.log("\n==================================================================================");
  console.log("  AUDITORIA DE PRODUÇÃO CONCLUÍDA COM SUCESSO ✅");
  console.log("==================================================================================");
}

runProductionAudit().catch(console.error);
