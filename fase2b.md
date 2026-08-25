# ECHONOTES-AI — RELATÓRIO DE AUDITORIA DE STORAGE E CONFIDENCIALIDADE DE ÁUDIO (FASE 2B)

**Data:** 25 de Agosto de 2026  
**Fase:** FASE 2B — Auditoria de Armazenamento e Confidencialidade de Áudio  
**Alvos:** `meeting-audio-temp`, `meeting-audio-backups`, `App.tsx`, `api/analyze.ts`  

---

## 1. INVENTÁRIO DE BUCKETS E FLUXO DE ÁUDIO

A auditoria identificou **2 buckets** no Supabase Storage utilizados pela aplicação:

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    CLIENTE (App.tsx)                   │
                               └───────────┬────────────────────────────────┬───────────┘
                                           │                                │
                 [1. Gravação / Upload]    │                                │ [Backup Permanente]
                                           ▼                                ▼
              ┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
              │        meeting-audio-temp                │    │        meeting-audio-backups             │
              │                                          │    │                                          │
              │  - Visibilidade: PÚBLICA (CRÍTICO)       │    │  - Visibilidade: PRIVADA / RLS           │
              │  - Path: temp_<timestamp>_<random>.ext   │    │  - Path: <user_id>/<timestamp>_backup    │
              │  - URL: getPublicUrl()                   │    │  - Persistência: Permanente              │
              └────────────────────┬─────────────────────┘    └──────────────────────────────────────────┘
                                   │
                                   │ [2. Public URL enviada no body]
                                   ▼
              ┌──────────────────────────────────────────┐
              │           /api/analyze (Backend)         │
              │  fetch(audioUrl) -> Google Gemini        │
              └────────────────────┬─────────────────────┘
                                   │
                                   │ [3. deleteAudioFromSupabase(tempFilePath)]
                                   ▼
              ┌──────────────────────────────────────────┐
              │     Remoção do ficheiro temporário       │
              │  (Falha se browser fechar antes)         │
              └──────────────────────────────────────────┘
```

---

## 2. RESPOSTA AOS 13 PONTOS DE AUDITORIA

### 1. Quais buckets existem?
- `meeting-audio-temp`: Usado para fazer upload temporário de áudios e contornar o limite de payload de 4.5 MB da Vercel.
- `meeting-audio-backups`: Usado para guardar uma cópia de segurança permanente dos áudios gravados no cliente.

### 2. São públicos ou privados?
- `meeting-audio-temp`: **PÚBLICO (`public: true`)** *(Usa o endpoint `/storage/v1/object/public/`)*.
- `meeting-audio-backups`: **PRIVADO** *(Gerido por políticas de `storage.objects`)*.

### 3. Quais policies de Storage existem?
- As políticas residem diretamente no esquema `storage.objects` do Supabase e não estão versionadas no repositório.

### 4. Quem pode fazer INSERT?
- `meeting-audio-temp`: Qualquer utilizador autenticado (via `uploadAudioToSupabase`).
- `meeting-audio-backups`: Qualquer utilizador autenticado (via `uploadPermanentBackup`).

### 5. Quem pode fazer SELECT/DOWNLOAD?
- `meeting-audio-temp`: **QUALQUER PESSOA NA INTERNET SEM AUTENTICAÇÃO**, através do link público permanente retornado por `getPublicUrl()`.
- `meeting-audio-backups`: Apenas utilizadores autorizados pelas regras de `storage.objects` (ou Super-Admin).

### 6. Quem pode fazer UPDATE?
- Ambos os uploads usam `upsert: false`. Ficheiros com o mesmo path não são sobrescritos acidentalmente.

### 7. Quem pode fazer DELETE?
- `meeting-audio-temp`: O cliente invoca `supabase.storage.from('meeting-audio-temp').remove([filePath])` após a conclusão da análise.

### 8. Um utilizador A consegue aceder ao áudio do utilizador B?
- **No bucket `meeting-audio-temp`:** **SIM (CONFIRMADO)**. Como os URLs são públicos e não requerem token de sessão, qualquer utilizador que capture ou intercete o URL consegue descarregar e ouvir o áudio confidencial.
- **No bucket `meeting-audio-backups`:** **POTENCIAL**. Depende da existência de política estrita no Supabase validando que `(storage.foldername(name))[1] = auth.uid()::text`.

### 9. Uma pessoa sem sessão consegue aceder a um áudio?
- **SIM (CONFIRMADO)** no bucket `meeting-audio-temp`. O link público gerado (`https://ioakfahzeddmkxicmkjw.supabase.co/storage/v1/object/public/meeting-audio-temp/...`) pode ser aberto em qualquer browser anónimo sem login.

### 10. `getPublicUrl()` é utilizado para dados confidenciais?
- **SIM (CONFIRMADO - VULNERABILIDADE CRÍTICA)**.  
  Em `src/App.tsx:199-201`:
  ```typescript
  const { data: { publicUrl } } = supabase.storage
    .from('meeting-audio-temp')
    .getPublicUrl(filePath);
  ```

### 11. Existem URLs públicas persistentes?
- **SIM**. Se a geração da ata falhar, o utilizador fechar o browser a meio do processamento ou o `deleteAudioFromSupabase()` falhar no bloco `catch`, o ficheiro de áudio permanece **indefinidamente no bucket público**.

### 12. Existem paths previsíveis?
- `meeting-audio-temp`: `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`  
  *(Timestamp sequencial e pseudoaleatoriedade fraca com `Math.random()`, gerando apenas 5 a 6 caracteres previsíveis)*.
- `meeting-audio-backups`: `${user.id}/${Date.now()}_backup.${fileExt}`  
  *(Path previsível se o UUID do utilizador for conhecido)*.

### 13. `meeting-audio-backups` está realmente isolado por `user_id`?
- **Apenas ao nível da convenção de nomes de pastas no cliente**. Se a política RLS do Storage no Supabase for permissiva, o isolamento não é garantido pelo servidor.

---

## 3. TABELA DE CLASSIFICAÇÃO DE RISCO DE STORAGE

| Bucket | Visibility | Anonymous access | Authenticated access | Owner isolation | Public URLs | Signed URLs | Risk | Severity |
|---|---|---|---|---|---|---|---|:---:|
| **`meeting-audio-temp`** | **PUBLIC** | **ALLOWED (Direto)** | **ALLOWED** | **NONE** | **ACTIVE (`getPublicUrl`)** | **INACTIVE** | **Fuga de Áudio Confidencial** | **CRITICAL** |
| **`meeting-audio-backups`** | **PRIVATE** | **DENIED** | **ALLOWED** | **Folder path `${user.id}`** | **INACTIVE** | **N/A** | **Risco de IDOR se RLS falhar** | **HIGH** |

---

## 4. O QUE PRECISA DE SER ALTERADO ANTES DE TORNAR OS BUCKETS PRIVADOS

Para eliminar esta vulnerabilidade sem quebrar o processamento de áudios no Gemini:

1. **Alterar a Visibilidade do Bucket no Supabase:**
   - Tornar o bucket `meeting-audio-temp` estritamente **PRIVADO** (`public: false`).
2. **Substituir `getPublicUrl` por `createSignedUrl` no Frontend (`src/App.tsx`):**
   - Alterar `uploadAudioToSupabase` para gerar um URL assinado com expiração de 5 minutos (300 segundos):
     ```typescript
     const { data, error } = await supabase.storage
       .from('meeting-audio-temp')
       .createSignedUrl(filePath, 300);
     const audioUrl = data.signedUrl;
     ```
3. **Compatibilidade com o Backend (`api/analyze.ts`):**
   - O comando `fetch(audioUrl)` em `api/analyze.ts` **continuará a funcionar sem qualquer alteração**, porque o token de autorização do Storage é transmitido de forma segura na query string assinada pelo Supabase (`?token=...`).
4. **Configurar Políticas RLS no Esquema `storage.objects`:**
   - `meeting-audio-temp`:
     - `INSERT / SELECT / DELETE`: Apenas utilizadores autenticados (`auth.role() = 'authenticated'`) ou `public.is_super_admin()`.
   - `meeting-audio-backups`:
     - `INSERT / SELECT / DELETE`: Apenas onde `auth.uid()::text = (storage.foldername(name))[1]` ou `public.is_super_admin()`.
5. **Rotina Automática de Limpeza (TTL / Auto-Purge):**
   - Criar uma rotina agendada para purgar ficheiros em `meeting-audio-temp` com mais de 1 hora, evitando acumulação de dados órfãos.
