-- ==============================================================================
-- FASE 4D: MIGRATION FOR PROCESSING_JOBS AND IDEMPOTENCY RPC
-- ==============================================================================

BEGIN;

-- 1. CRIAR TABELA public.processing_jobs
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_fingerprint TEXT NOT NULL,
    audio_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    lease_until TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT 'gemini',
    model TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ÍNDICE ÚNICO PARCIAL PARA IDEMPOTÊNCIA ACTIVA
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_fingerprint_job 
ON public.processing_jobs (user_id, request_fingerprint) 
WHERE status IN ('pending', 'processing');

-- 3. ÍNDICE COMPOSTO PARA LOOKUP DE RESULTADOS E CACHE
CREATE INDEX IF NOT EXISTS idx_processing_jobs_lookup 
ON public.processing_jobs (user_id, request_fingerprint, status);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Revogar mutações directas do cliente
REVOKE INSERT, UPDATE, DELETE ON public.processing_jobs FROM anon, authenticated;

-- Dropar policy se existir para recriar
DROP POLICY IF EXISTS "jobs_select_owner" ON public.processing_jobs;

-- SELECT apenas para o próprio utilizador ou SUPER_ADMIN
CREATE POLICY "jobs_select_owner" ON public.processing_jobs
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR public.is_super_admin()
);

-- 5. RPC PRIVILEGIADO: public.claim_processing_job
CREATE OR REPLACE FUNCTION public.claim_processing_job(
    p_user_id UUID,
    p_request_fingerprint TEXT,
    p_audio_hash TEXT
) RETURNS TABLE (
    job_id UUID, 
    action_taken TEXT, 
    job_status TEXT, 
    meeting_id UUID
) AS $$
DECLARE
    v_job public.processing_jobs%ROWTYPE;
    v_default_model TEXT := 'gemini-3.6-flash';
    v_default_lease_seconds INT := 360; -- 6 minutos centralizados
BEGIN
    -- A. Validação de parâmetros e utilizador
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid user_id: parameter is required' USING ERRCODE = '22004';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Invalid user_id: referenced user does not exist' USING ERRCODE = '23503';
    END IF;

    -- B. Validação estrita de formato SHA-256 (64 hex lowercase)
    IF p_audio_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Invalid audio_hash format: expected 64-character lowercase hex string' USING ERRCODE = '22023';
    END IF;

    IF p_request_fingerprint !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Invalid request_fingerprint format: expected 64-character lowercase hex string' USING ERRCODE = '22023';
    END IF;

    -- 1. CASO A: Verificar se já existe concluído (Cache Hit)
    SELECT * INTO v_job 
    FROM public.processing_jobs 
    WHERE user_id = p_user_id 
      AND request_fingerprint = p_request_fingerprint 
      AND status = 'completed'
    ORDER BY completed_at DESC LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_job.id, 'CACHE_HIT'::TEXT, v_job.status, v_job.result_meeting_id;
        RETURN;
    END IF;

    -- 2. TENTATIVA ATÓMICA DE INSERÇÃO DO NOVO JOB
    INSERT INTO public.processing_jobs (
        user_id, request_fingerprint, audio_hash, status, lease_until, model, attempts
    ) VALUES (
        p_user_id, p_request_fingerprint, p_audio_hash, 'processing', 
        now() + (v_default_lease_seconds || ' seconds')::interval, 
        v_default_model, 1
    )
    ON CONFLICT (user_id, request_fingerprint) WHERE status IN ('pending', 'processing')
    DO NOTHING
    RETURNING * INTO v_job;

    IF v_job.id IS NOT NULL THEN
        RETURN QUERY SELECT v_job.id, 'NEW_JOB_CREATED'::TEXT, v_job.status, v_job.result_meeting_id;
        RETURN;
    END IF;

    -- 3. CASO DE CONCORRÊNCIA (A linha já existe: bloquear para inspecionar)
    SELECT * INTO v_job 
    FROM public.processing_jobs 
    WHERE user_id = p_user_id 
      AND request_fingerprint = p_request_fingerprint 
      AND status IN ('pending', 'processing')
    FOR UPDATE;

    IF FOUND THEN
        -- CASO B: Lease Válido ➔ Outra request está em curso
        IF v_job.lease_until > now() THEN
            RETURN QUERY SELECT v_job.id, 'ALREADY_IN_PROGRESS'::TEXT, v_job.status, v_job.result_meeting_id;
            RETURN;
        ELSE
            -- CASO C: Lease Expirado ➔ Reclaim Atómico
            UPDATE public.processing_jobs
            SET status = 'processing',
                lease_until = now() + (v_default_lease_seconds || ' seconds')::interval,
                attempts = attempts + 1,
                model = v_default_model,
                started_at = now(),
                error_message = NULL
            WHERE id = v_job.id
            RETURNING * INTO v_job;

            RETURN QUERY SELECT v_job.id, 'RECLAIMED_EXPIRED'::TEXT, v_job.status, v_job.result_meeting_id;
            RETURN;
        END IF;
    END IF;

    -- Salvaguarda: Caso tenha completado durante a espera pelo lock
    SELECT * INTO v_job 
    FROM public.processing_jobs 
    WHERE user_id = p_user_id 
      AND request_fingerprint = p_request_fingerprint 
      AND status = 'completed'
    ORDER BY completed_at DESC LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_job.id, 'CACHE_HIT'::TEXT, v_job.status, v_job.result_meeting_id;
        RETURN;
    END IF;

    RAISE EXCEPTION 'Concurrency resolution failed: unexpected state transition' USING ERRCODE = '40001';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. SECURITY MODEL DO RPC (APENAS SERVICE_ROLE)
REVOKE ALL ON FUNCTION public.claim_processing_job(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_processing_job(UUID, TEXT, TEXT) TO service_role;

COMMIT;
