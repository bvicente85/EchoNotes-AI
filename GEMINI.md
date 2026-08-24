# EchoNotes-AI (SUMA) Workspace Guidelines & Architectural Invariants

## 1. AI Provider & Architecture Invariants
- **Primary Engine**: The entire application is standardized on **Groq** (`whisper-large-v3-turbo` for speech-to-text + high-speed LPU LLMs like `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `groq/compound` for report synthesis and the chat assistant).
- **No Unprovisioned Gemini Endpoints**: Do not revert to Google Gemini (`@google/genai`) unless explicitly instructed by the user and confirmed to have paid Google Cloud billing enabled.

## 2. Serverless Function Constraints (Vercel)
- Any audio-processing or AI-synthesizing serverless function in `api/` must export:
  ```typescript
  export const maxDuration = 300;
  export const dynamic = 'force-dynamic';
  ```
- Audio files transferred via Supabase Storage URLs must default missing `mimeType` to `'audio/webm'`.

## 3. Whisper Speech-to-Text Guidelines
- When transcribing European Portuguese (PT-PT) sessions via Groq Whisper, always supply:
  - `language`: `'pt'`
  - `prompt`: `'Ata de reunião executiva em português de Portugal (PT-PT).'`
  - `temperature`: `'0'`
- Preserve vocabulary rules: use `planeamento` (not *planejamento*), `equipa` (not *equipe*), `utilizador` (not *usuário*).

## 4. Resilient Multi-Stage JSON Parsing
- Never use unshielded `JSON.parse()` on open-source LLM outputs.
- Always apply multi-stage sanitization:
  1. Strip markdown fences (```json ... ```).
  2. Extract outer JSON boundaries via regex (`/\{[\s\S]*\}/`).
  3. Clean trailing commas and control characters.
  4. Fallback gracefully to intelligent markdown text extraction (paragraphs to summary, bullet points to highlights) so the UI never crashes with `PARSE_ERROR`.

## 5. Storage & Privacy Architecture (Supabase)
- **Permanent User Backups**: Always stored under `meeting-audio-backups/${user.id}/${timestamp}_backup.webm`.
- **Ephemeral Transits**: Stored in `meeting-audio-temp/` and **must always be deleted** in the `finally` block immediately after download/analysis.
