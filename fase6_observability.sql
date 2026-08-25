-- ==============================================================================
-- FASE 6.1: HARDENING DA OBSERVABILIDADE & MÉTRICAS (GEMINI_USAGE_LOGS)
-- ==============================================================================

BEGIN;

-- 1. RECRIAR/ATUALIZAR TABELA public.gemini_usage_logs
CREATE TABLE IF NOT EXISTS public.gemini_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    query_type TEXT NOT NULL,
    intent TEXT,
    context_size INT NOT NULL DEFAULT 0,
    tokens_input INT NOT NULL DEFAULT 0,
    tokens_output INT NOT NULL DEFAULT 0,
    primary_model TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
    final_model TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
    model_used TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    fallback_reason TEXT,
    error_type TEXT,
    pipeline_version TEXT NOT NULL DEFAULT 'phase6',
    latency_ms INT NOT NULL,
    fts_latency_ms INT DEFAULT 0,
    gemini_latency_ms INT DEFAULT 0,
    has_transcript BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar colunas caso a tabela já exista
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='request_id') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN request_id UUID NOT NULL DEFAULT gen_random_uuid();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='error_type') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN error_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='pipeline_version') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN pipeline_version TEXT NOT NULL DEFAULT 'phase6';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='primary_model') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN primary_model TEXT NOT NULL DEFAULT 'gemini-3.6-flash';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='final_model') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN final_model TEXT NOT NULL DEFAULT 'gemini-3.6-flash';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gemini_usage_logs' AND column_name='fallback_reason') THEN
        ALTER TABLE public.gemini_usage_logs ADD COLUMN fallback_reason TEXT;
    END IF;
END $$;

-- 2. ÍNDICES DE PERFORMANCE E CORRELAÇÃO TÉCNICA
CREATE INDEX IF NOT EXISTS idx_usage_logs_request_id 
ON public.gemini_usage_logs (request_id);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date 
ON public.gemini_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_model 
ON public.gemini_usage_logs (final_model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_logs_error 
ON public.gemini_usage_logs (error_type) WHERE error_type IS NOT NULL;

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.gemini_usage_logs ENABLE ROW LEVEL SECURITY;

-- Revogar mutações directas do cliente
REVOKE INSERT, UPDATE, DELETE ON public.gemini_usage_logs FROM anon, authenticated;

-- Leitura apenas para o próprio dono das métricas ou SUPER_ADMIN
DROP POLICY IF EXISTS "logs_select_owner" ON public.gemini_usage_logs;
CREATE POLICY "logs_select_owner" ON public.gemini_usage_logs
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR public.is_super_admin()
);

-- 4. VIEW ADMINISTRATIVA DE SUMÁRIO AGREGADO
CREATE OR REPLACE VIEW public.gemini_usage_summary AS
SELECT 
    COUNT(*)::INT AS total_queries,
    COALESCE(ROUND(AVG(latency_ms)), 0)::INT AS avg_latency_ms,
    COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)), 0)::INT AS p95_latency_ms,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE is_fallback = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2), 0) AS fallback_rate_pct,
    COALESCE(ROUND(AVG(tokens_input)), 0)::INT AS avg_tokens_input,
    COALESCE(ROUND(AVG(tokens_output)), 0)::INT AS avg_tokens_output,
    COUNT(*) FILTER (WHERE intent = 'STRUCTURED_QUERY')::INT AS count_structured_queries,
    COUNT(*) FILTER (WHERE intent = 'HISTORICAL_QUERY')::INT AS count_historical_queries,
    COUNT(*) FILTER (WHERE intent = 'TRANSCRIPT_QUERY')::INT AS count_transcript_queries,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE has_transcript = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2), 0) AS transcript_usage_rate_pct,
    COUNT(*) FILTER (WHERE error_type IS NOT NULL)::INT AS total_errors,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE error_type IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2), 0) AS error_rate_pct
FROM public.gemini_usage_logs;

-- Permissões da view: acessível a autenticados (com dados governados por RLS subjacente) e super-admin
GRANT SELECT ON public.gemini_usage_summary TO authenticated;

COMMIT;
