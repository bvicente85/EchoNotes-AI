-- ==============================================================================
-- FASE 5: MIGRATION FOR FULL-TEXT SEARCH ON MEETINGS (ASK GEMINI)
-- ==============================================================================

BEGIN;

-- 1. CRIAR ÍNDICE DE EXPRESSÃO GIN PARA PESQUISA FULL-TEXT EM MEETINGS
CREATE INDEX IF NOT EXISTS meetings_report_search_idx
ON public.meetings
USING GIN (
    (
        to_tsvector(
            'portuguese',
            coalesce(title, '') || ' ' ||
            coalesce(report->>'clientName', '') || ' ' ||
            coalesce(report->>'summary', '') || ' ' ||
            coalesce((report->'keyDecisions')::text, '') || ' ' ||
            coalesce((report->'nextActions')::text, '')
        )
    )
);

-- 2. FUNÇÃO PRIVILEGIADA: public.search_user_meetings
CREATE OR REPLACE FUNCTION public.search_user_meetings(
    p_user_id UUID,
    p_search_query TEXT,
    p_limit INT DEFAULT 3
) RETURNS TABLE (
    id UUID,
    title TEXT,
    date TIMESTAMPTZ,
    client_name TEXT,
    summary TEXT,
    key_decisions JSONB,
    next_actions JSONB,
    rank REAL
) AS $$
BEGIN
    -- Validação de utilizador
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid user_id: parameter is required' USING ERRCODE = '22004';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Invalid user_id: referenced user does not exist' USING ERRCODE = '23503';
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.created_at AS date,
        m.report->>'clientName' AS client_name,
        m.report->>'summary' AS summary,
        m.report->'keyDecisions' AS key_decisions,
        m.report->'nextActions' AS next_actions,
        CASE 
            WHEN p_search_query IS NOT NULL AND p_search_query <> '' THEN
                ts_rank(
                    to_tsvector(
                        'portuguese',
                        coalesce(m.title, '') || ' ' ||
                        coalesce(m.report->>'clientName', '') || ' ' ||
                        coalesce(m.report->>'summary', '') || ' ' ||
                        coalesce((m.report->'keyDecisions')::text, '') || ' ' ||
                        coalesce((m.report->'nextActions')::text, '')
                    ),
                    websearch_to_tsquery('portuguese', p_search_query)
                )
            ELSE 0.0::REAL
        END AS rank
    FROM public.meetings m
    WHERE m.user_id = p_user_id
      AND (
          p_search_query IS NULL 
          OR p_search_query = ''
          OR to_tsvector(
              'portuguese',
              coalesce(m.title, '') || ' ' ||
              coalesce(m.report->>'clientName', '') || ' ' ||
              coalesce(m.report->>'summary', '') || ' ' ||
              coalesce((m.report->'keyDecisions')::text, '') || ' ' ||
              coalesce((m.report->'nextActions')::text, '')
          ) @@ websearch_to_tsquery('portuguese', p_search_query)
      )
    ORDER BY rank DESC, m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. PERMISSÕES ESTRITAS (APENAS SERVICE_ROLE USADA PELO BACKEND)
REVOKE ALL ON FUNCTION public.search_user_meetings(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_user_meetings(UUID, TEXT, INT) TO service_role;

COMMIT;
