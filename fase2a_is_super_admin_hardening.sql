-- ==============================================================================
-- HARDENING DA FUNÇÃO public.is_super_admin() (SECURITY DEFINER & SEARCH_PATH)
-- ==============================================================================

-- 1. Recria a função com search_path seguro e imutável
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Avalia directamente na tabela protegida bypassando RLS via SECURITY DEFINER
    RETURN EXISTS (
        SELECT 1 
        FROM public.admin_roles 
        WHERE user_id = current_uid AND role = 'super_admin'
    );
END;
$$;

-- 2. Revogar permissão de execução de PUBLIC e anon
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- 3. Manter permissão de execução para authenticated (necessário para RLS) e service_role (backend)
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
