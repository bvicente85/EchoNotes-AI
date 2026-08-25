# ECHONOTES-AI (SUMA) — RELATÓRIO COMPLETO DE AUDITORIA RED TEAM

**Data da Auditoria:** 25 de Agosto de 2026  
**Tipo de Auditoria:** Red Team, Vulnerability & Failure Mode Analysis (Strict Read-Only Audit)  
**Alvo:** EchoNotes-AI (Frontend React 19 + Vercel Serverless Functions + Google Gen AI SDK + Supabase)  

---

# FASE 1 — MAPA COMPLETO DO SISTEMA

## 1.1 Diagrama de Fluxo e Arquitetura Real

```text
                                  [ UTILIZADOR ]
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
  [ Microfone ]                 [ Áudio de Sistema ]              [ Upload Ficheiro ]
        │                                │                                │
        └────────────────────────────────┬────────────────────────────────┘
                                         ▼
                     ┌───────────────────────────────────────┐
                     │         FRONTEND (React 19)           │
                     │          (src/App.tsx)                │
                     └───────────────────┬───────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│    INDEXEDDB     │           │   LOCALSTORAGE   │           │     SUPABASE     │
│ - Chunks (5s)    │           │ - Preferências   │           │ - Auth (Sessão)  │
│ - Pending Audios │           │ - Configurações  │           │ - Profiles (DB)  │
│ - Cache Local    │           │ - Tasks Estado   │           │ - Storage Temp   │
└──────────────────┘           └──────────────────┘           └──────────┬───────┘
                                                                         │
                                                                         ▼
                                                              ┌──────────────────┐
                                                              │ VERCEL SERVERLESS│
                                                              │ - /api/analyze   │
                                                              │ - /api/chat      │
                                                              │ - /api/test-env  │
                                                              └──────────┬───────┘
                                                                         │
                                                                         ▼
                                                              ┌──────────────────┐
                                                              │  GOOGLE GEN AI   │
                                                              │ - Files API (>15M)│
                                                              │ - Gemini Models  │
                                                              └──────────┬───────┘
                                                                         │
                                                                         ▼
                                                              ┌──────────────────┐
                                                              │  MEETING REPORT  │
                                                              │ - JSON Parsed    │
                                                              │ - Enrich Report  │
                                                              └──────────┬───────┘
                                                                         │
                                         ┌───────────────────────────────┴───────────────────────────────┐
                                         ▼                                                               ▼
                              ┌────────────────────┐                                          ┌────────────────────┐
                              │  PERSISTÊNCIA DB   │                                          │  UI & EXPORTAÇÕES  │
                              │ - meetings table   │                                          │ - ReportView.tsx   │
                              │ - local audio save │                                          │ - TXT, MD, PDF, DOC│
                              └────────────────────┘                                          └────────────────────┘
```

---

# FASE 2 — RED TEAM DO FRONTEND

### Principais Fraquezas e Comportamentos Identificados:
1. **Componente Monolítico Central (`src/App.tsx`):**  
   O ficheiro `App.tsx` contém **3.791 linhas de código**. Gere em simultâneo: ciclo de vida do `MediaRecorder`, renderização a 60 FPS do visualizador Web Audio (`requestAnimationFrame`), manipulação de áudio pendente, submissão de IA, sincronização de perfil Supabase, modais, tema e listas de tarefas.
2. **Double Submissions e Race Conditions:**  
   Não existe bloqueio idempotente ao clicar rapidamente em botões de ação ou troca de abas durante gravações e uploads, o que pode originar uploads duplicados para o Supabase Storage.
3. **Memory Leaks de Canvas / Visualizador:**  
   A callback de animação `updateVisualization` é agendada recursivamente sem garantia de encerramento total caso ocorram exceções dentro do ciclo.

---

# FASE 3 — AUDIO RED TEAM

### Teste de Limites e Falhas de Hardware/Navegador:
1. **Microfone Desconectado a Meio da Sessão:** O evento `onerror` do stream não força a transição de estado da UI de forma graciosa, deixando a gravação "ativa" sem receber bytes reais.
2. **Bloqueio de Ecrã / Background Tab:** Em dispositivos móveis (iOS Safari / Android Chrome), colocar o browser em segundo plano ou bloquear o ecrã congela o temporizador da thread principal e suspende a captura do `MediaRecorder`.
3. **Áudio de Zero Bytes / Silêncio Absoluto:** A aplicação envia ficheiros de silêncio para a Google Gemini, consumindo tokens e gerando sumários alucinados ou erros de análise.
4. **Limites de Tempo Estimados:**
   - **30s a 5 min:** Processamento estável via inline Base64.
   - **15 min a 30 min:** Sucesso dependente do bypass de upload para Supabase Storage.
   - **60 min a 120 min:** Risco crítico de timeout Serverless na Vercel (limite de 300s em funções Pro / 10s-60s em contas Hobby).

---

# FASE 4 — PROCESSAMENTO GEMINI

### Análise Profunda do Pipeline de IA:
1. **Modelos Inválidos no Pool:** O array de fallback em `api/geminiBackend.ts` contém modelos fictícios (`gemini-3.5-flash`, `gemini-3.6-flash`, etc.), forçando o sistema a apanhar 404 sucessivos até encontrar um modelo real.
2. **Circuit Breaker Incompleto:** O `Promise.race` com timeout de 25s não aborta o request HTTP pendente na Google Cloud (`ai.models.generateContent`), acumulando requisições fantasmas em segundo plano.
3. **Consumo por Reunião:** Em caso de falha transitória, uma única reunião pode disparar até **7 tentativas de modelos sucessivas**, demorando até 175 segundos e consumindo múltiplas quotas de API.

---

# FASE 5 — SEGURANÇA & AUTORIZAÇÃO

### Vetores de Ataque Confirmados:
1. **Endpoints de IA Abertos sem Autenticação (`/api/analyze` e `/api/chat`):** Qualquer utilizador ou bot anónimo pode fazer pedidos POST e consumir a cota da Google Gemini sem restrições.
2. **Server-Side Request Forgery (SSRF):** O parâmetro `audioUrl` em `/api/analyze` executa `fetch()` direto sem validar a origem do URL.
3. **Escalada de Privilégios (Admin):** O papel de administrador é gravado na tabela `profiles` a partir de mutações diretas do cliente frontend.
4. **Information Disclosure (`/api/test-env`):** Devolve publicamente prefixos de chaves privadas, versões de software e metadados de commits do Git.

---

# FASE 6 — SUPABASE & BASE DE DADOS

### Avaliação de Queries e RLS:
1. **IDOR Potencial:** As funções `deleteFromHistory` e `updateHistoryItem` em `src/services/storage.ts` executam queries `.delete().eq('id', id)` sem passar `.eq('user_id', userId)`. A segurança depende a 100% de políticas RLS remotas.
2. **Sem Versionamento Local de Migrações:** O esquema de base de dados e as políticas RLS não se encontram versionadas no repositório em ficheiros SQL.

---

# FASE 7 — PERDA DE DADOS (DATA LOSS MATRIX)

| Cenário | Estado do Dado | Justificação Técnica |
|---|---|---|
| **Crash do Browser Durante Gravação** | `DATA RECOVERABLE` | Chunks são guardados no IndexedDB (`echonote_backup_db`) a cada 5 segundos. |
| **Fecho de Aba / Refresh Durante Análise** | `DATA LOST` | Se o processamento estiver a correr na Vercel e a aba for fechada antes da resposta JSON, o relatório não é gravado na BD. |
| **Mais de 20 Reuniões Gravadas** | `DATA INACCESSIBLE` | A query tem `.limit(20)` fixo sem paginação na UI. |
| **Gravação com Telemóvel Bloqueado** | `DATA LOST` | O navegador suspende o processo sem a API Wake Lock. |
| **Falha de Rede Após Upload do Áudio** | `DATA SAFE` | O áudio é salvaguardado no Supabase Storage (`meeting-audio-backups`). |

---

# FASE 8 — PENDING RECORDINGS

- **Memory Leak OOM:** A chamada `store.getAll()` em `src/services/pendingRecordings.ts` lê todos os Blobs de áudio pesados para a RAM do browser antes de filtrar metadados.
- **Acumulação sem Limites:** Não existe purge automático de gravações pendentes, permitindo que o IndexedDB esgote o armazenamento local do dispositivo.

---

# FASE 9 — HISTÓRICO & PAGINAÇÃO

- **Limite Hardcoded:** `getHistory` está bloqueado a 20 registos (`.limit(20)`).
- **Pesquisa Incompleta:** A pesquisa no dashboard apenas filtra os 20 registos carregados em memória no cliente, ignorando registos mais antigos.

---

# FASE 10 — ASK GEMINI

- **Sem Memória de Conversa (Stateless):** O histórico prévio de mensagens (`chatHistory`) é ignorado no backend.
- **Contexto Truncado:** O transcript da reunião é cortado nos primeiros 80 itens e os sumários históricos truncados a 400 caracteres.
- **Crash por Propriedades Nulas:** `h.report.summary` sem optional chaining provoca HTTP 500 se existirem itens corrompidos no histórico.

---

# FASE 11 — DIARIZAÇÃO & IDENTIFICAÇÃO DE ORADORES

- **Identificação Não Biométrica:** O sistema não analisa assinaturas acústicas de voz; apenas instrui o LLM no prompt a associar os nomes fornecidos com base no contexto textual e ordem cronológica.
- **Risco:** Atribuição errada de decisões e compromissos legais a oradores trocados.

---

# FASE 12 — QUICK DRAFT

- Funcionalidade estável e rápida para notas curtas, partilhando o mesmo pipeline de backend do modo reunião com prompt especializado para scratchpad, checklists e rascunhos de e-mail.

---

# FASE 13 — EXPORTAÇÕES

- **PDF com Falhas de Codificação:** A biblioteca `jsPDF` utiliza fontes padrão que corrompem caracteres acentuados (`ã`, `õ`, `ç`, `é`) em relatórios em Português.
- **Word (.doc) via HTML Mime:** O ficheiro Word é exportado como HTML com extensão `.doc`, provocando avisos de "Protected View" no Microsoft Word.

---

# FASE 14 — INTERNACIONALIZAÇÃO (PT-PT / EN)

- O sistema inclui suporte extenso de traduções em `src/lib/translations.ts`, mas apresenta inconsistências visuais e métricas hardcoded no dashboard que não refletem os dados reais do utilizador.

---

# FASE 15 — COMPATIBILIDADE DE DISPOSITIVOS

- **Chrome / Edge Desktop:** Suporte completo de áudio de sistema e microfone.
- **Safari Desktop / Mobile:** Sem suporte para captura de áudio do sistema (`getDisplayMedia`); gravação em segundo plano vulnerável a suspensão do SO.
- **Firefox:** Suporte variável de codecs WebM/Opus.

---

# FASE 16 — PERFORMANCE

- O estado do analisador de áudio atualiza a interface a 60 FPS dentro do componente raiz `App.tsx`, provocando re-renderizações em cascata de toda a árvore DOM.

---

# FASE 17 — CONCORRÊNCIA

- Abertura de múltiplas abas pode originar tentativas de migração simultâneas de dados locais e colisões em gravações de backup temporárias.

---

# FASE 18 — FAILURE INJECTION

- Se a chave da Google Cloud expirar ou atingir a quota (HTTP 429), o backend tenta sucessivamente todos os modelos do pool antes de devolver erro ao cliente, mantendo o utilizador em espera durante minutos.

---

# FASE 19 — QUALIDADE DE CÓDIGO

- Duplicação de tipos e interfaces entre `api/geminiBackend.ts`, `src/services/gemini.ts` e `src/services/storage.ts`.
- Função `boostAudioVolume` que efetua trabalho intensivo de Web Audio em CPU/RAM e descarta o resultado no retorno.

---

# FASE 20 — COBERTURA DE TESTES

- **Testes Automatizados Existentes:** 0 (zero).
- Não existem testes unitários, testes de integração de API nem testes end-to-end configurados no `package.json`.

---

# MATRIZ FINAL DE RISCOS E FINDINGS

| ID | Severidade | Confiança | Categoria | Componente | Impacto Principal |
|---|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | CONFIRMED BUG | Segurança | `api/analyze.ts`, `api/chat.ts` | Consumo descontrolado de API Gemini, custos imprevistos, DoS |
| **SEC-02** | **CRITICAL** | CONFIRMED BUG | Segurança | `api/analyze.ts` | SSRF contra rede interna e instâncias cloud |
| **SEC-03** | **HIGH** | CONFIRMED BUG | Segurança | `api/test-env.ts`, `api/test-import.ts` | Exposição de metadados de commits, variáveis e prefixo de chaves |
| **SEC-04** | **CRITICAL** | CONFIRMED BUG | Autorização | `App.tsx`, `AdminDashboard.tsx` | Escalada direta a Administrador e acesso a reuniões alheias |
| **SEC-05** | **HIGH** | CONFIRMED BUG | Autorização | `services/storage.ts` | Potencial IDOR se RLS do Supabase estiver desativada/permissiva |
| **DATA-01** | **HIGH** | CONFIRMED BUG | Gestão de Dados | `services/storage.ts` | Reuniões após a 20ª ficam permanentemente inacessíveis |
| **DATA-02** | **HIGH** | CONFIRMED BUG | Performance | `services/pendingRecordings.ts` | Crash da aba por OOM ao carregar gravações pendentes |
| **AI-01** | **HIGH** | CONFIRMED BUG | Qualidade IA | `api/geminiBackend.ts` | Chat sem memória de contexto e transcript cortado aos 80 itens |
| **AI-02** | **HIGH** | CONFIRMED BUG | Estabilidade | `api/geminiBackend.ts` | Erro 500 no chat se histórico contiver registo sem `report` |
| **AI-03** | **MEDIUM** | CONFIRMED BUG | IA / Latência | `api/geminiBackend.ts` | Modelos inexistentes atrasam o processamento em cascata |
| **AUDIO-01** | **HIGH** | CONFIRMED BUG | Áudio | `services/audioProcessor.ts` | Processamento PCM inútil que consome CPU/RAM e descarta resultado |
| **AUDIO-02** | **HIGH** | POTENTIAL FAILURE | Áudio | `App.tsx` | Suspensão de gravação ao bloquear ecrã ou alternar de aba |
| **EXPORT-01** | **MEDIUM** | CONFIRMED BUG | Exportação | `ReportView.tsx` | Acentos corrompidos (mojibake) em exportações PDF em Português |
| **UI-01** | **MEDIUM** | CONFIRMED BUG | UI | `DashboardBentoView.tsx` | Métricas falsas hardcoded (12 sessões, 45 min, 98.8% accuracy) |
| **SPEAKER-01** | **MEDIUM** | DESIGN WEAKNESS | IA / Diarização | `api/geminiBackend.ts` | Falsas atribuições de falas por inferência textual e não biométrica |
| **PERF-01** | **MEDIUM** | TECHNICAL DEBT | Arquitetura | `App.tsx` | Ficheiro monolítico com 3.790 linhas com re-renders a 60fps |
| **TEST-01** | **HIGH** | TECHNICAL DEBT | Qualidade | Repositório | Zero testes automatizados (unitários, integração ou E2E) |

---

# TOP 10 PROBLEMAS MAIS IMPORTANTES

1. **[SEC-01] Endpoints de IA `/api/analyze` e `/api/chat` totalmente públicos e sem autenticação** (Risco financeiro e operacional iminente).
2. **[SEC-04] Escalada de privilégios de Admin e aprovação controlada pelo cliente** (Risco de quebra de confidencialidade de reuniões).
3. **[SEC-02] Vulnerabilidade de SSRF através do parâmetro `audioUrl`** (Risco de ataque a serviços de rede interna e cloud).
4. **[DATA-01] Histórico limitado a 20 reuniões sem paginação** (Perda definitiva de acesso a dados históricos antigos).
5. **[DATA-02] Vazamento de memória e crash OOM em `getPendingRecordings`** (Instabilidade grave em dispositivos móveis).
6. **[AUDIO-02] Gravação interrompida por suspensão do browser em segundo plano** (Perda de áudio durante reuniões).
7. **[AI-01] Chat Ask Gemini stateless e truncamento de reuniões longas** (Respostas incorretas e alucinações).
8. **[SEC-03] Exposição de metadados e prefixo de chaves em `/api/test-env`** (Vazamento de dados operacionais).
9. **[AUDIO-01] Função `boostAudioVolume` placebo e vazamento de instâncias Web Audio** (Desperdício de CPU/RAM).
10. **[EXPORT-01] Corrupção de caracteres portugueses (UTF-8) no export de PDF** (Documentos executivos ilegíveis).

---

# BUGS CONFIRMADOS

- `SEC-01`: Endpoints `/api/analyze` e `/api/chat` não validam tokens de autenticação nem aplicam rate limits.
- `SEC-02`: `fetch(audioUrl)` sem validação de domínio em `api/analyze.ts`.
- `SEC-03`: Ficheiro `api/test-env.ts` exposto em produção devolvendo detalhes de commits e prefixos de chaves.
- `SEC-04`: `role` e aprovação atribuídos diretamente pelo cliente em `App.tsx` e `LoginPage.tsx`.
- `DATA-01`: `.limit(20)` fixo em `services/storage.ts` ocultando todas as reuniões anteriores.
- `DATA-02`: `store.getAll()` em `services/pendingRecordings.ts` carregando todos os Blobs de áudio para a memória no arranque.
- `AI-01`: Parâmetro `chatHistory` ignorado no backend Gemini e corte do transcript nos primeiros 80 itens.
- `AI-02`: Acesso `h.report.summary` sem optional chaining em `geminiBackend.ts` provocando erro 500.
- `AI-03`: Modelos fictícios (`gemini-3.5-flash`, etc.) no pool de modelos.
- `AUDIO-01`: `boostAudioVolume` decodifica PCM e devolve o Blob original sem qualquer alteração.
- `EXPORT-01`: jsPDF a usar fontes ASCII padrão que corrompem caracteres acentuados em Português.
- `UI-01`: Valores mock hardcoded (12 reuniões, 45 min, 98.5% precisão) exibidos no Dashboard Bento.

---

# RISCOS POTENCIAIS

- **`AUDIO-02`:** Suspensão do MediaRecorder e perda de reuniões quando a aba é minimizada ou o ecrã do telemóvel bloqueia sem WakeLock ativo.
- **`SEC-05`:** IDOR em `deleteFromHistory` e `updateHistoryItem` se as políticas de RLS no Supabase forem desativadas ou configuradas de forma permissiva.
- **`SPEAKER-01`:** Atribuição errada de decisões e compromissos a participantes por inferência textual do LLM.
- **`PERF-01`:** Queda de framerate da interface durante gravação devido ao estado de 60fps do analisador de áudio residir no componente raiz `App.tsx`.

---

# O QUE NÃO FOI POSSÍVEL VERIFICAR (UNVERIFIABLE)

1. **Configuração Real de RLS (Row Level Security) no Supabase Cloud:** As políticas SQL ativas nas tabelas `meetings` e `profiles` residem no dashboard remoto do Supabase e não estão versionadas em ficheiros de migração SQL locais no repositório.
2. **Políticas de Acesso aos Buckets de Storage:** Não é possível verificar localmente se os buckets `meeting-audio-temp` e `meeting-audio-backups` possuem regras RLS de isolamento de pastas por `auth.uid()`.
3. **Limites de Quota e Faturação na Google Cloud Console:** As quotas por minuto (RPM/TPM) e plafonds de faturação da `GEMINI_API_KEY` apenas podem ser consultados na consola da Google Cloud.
4. **Comportamento Físico de Hardware em Diferentes Dispositivos:** O cancelamento de eco de hardware em modelos específicos de telemóveis e headsets Bluetooth necessita de testes físicos em hardware real.

---

# FINAL VERDICT

1. **Está pronta para utilização pessoal?**  
   *Sim, com ressalvas.* Para uso individual em desktop com revisão atenta dos relatórios gerados.
2. **Está pronta para utilização interna numa empresa?**  
   *Não.* A ausência de autenticação nas APIs de IA e a autorização controlada pelo cliente representam um risco corporativo inaceitável.
3. **Está pronta para utilização com clientes externos?**  
   *Não.* O export de PDF corrompe acentos em Português e o chat assistente perde o contexto.
4. **Está pronta para produção?**  
   **NÃO.**
5. **Qual é o maior risco técnico?**  
   O consumo descontrolado de memória RAM com Blobs de áudio e a arquitetura monolítica de 3.790 linhas no frontend.
6. **Qual é o maior risco de segurança?**  
   Endpoints de IA abertos sem autenticação, SSRF e escalada de privilégios de Administrador.
7. **Qual é o maior risco de perda de dados?**  
   Suspensão silenciosa da gravação pelo navegador em segundo plano e bloqueio de histórico aos 20 registos.
8. **Qual é o maior risco de escalabilidade?**  
   Upload de áudios de grande porte em chamadas Serverless na Vercel com limites rígidos de payload e timeouts.
9. **Qual é o maior risco específico da utilização de IA?**  
   Diarização com falsa confiança (atribuição de falas por contexto textual e não biometria) e perda de contexto no Ask Gemini.
10. **Qual seria a prioridade absoluta antes de colocar em produção?**  
    Autenticar os endpoints de backend com validação JWT do Supabase, proteger as permissões de utilizador no PostgreSQL via triggers e implementar paginação no histórico.

---

### **CLASSIFICAÇÃO GLOBAL:** `4.8 / 10`

---
