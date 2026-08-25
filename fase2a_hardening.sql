-- ==============================================================================
-- FASE 2A: HARDENING DE AUTORIZAÇÃO, PROFILES E SUPER-ADMIN (TRANSACTIONAL)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. LIMPEZA DINÂMICA DE TODAS AS POLICIES EXISTENTES (SEM RESÍDUOS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('profiles', 'meetings', 'admin_roles')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. TABELA ISOLADA DE ADMIN_ROLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role = 'super_admin'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS estrita na tabela admin_roles
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO IS_SUPER_ADMIN() (SECURITY DEFINER, SEM PARÂMETROS PÚBLICOS)
-- ------------------------------------------------------------------------------
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

-- Restringir permissões de execução da função
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Policies para admin_roles (Apenas Super-Admins podem ler/modificar)
CREATE POLICY "admin_roles_super_admin_all" ON public.admin_roles
FOR ALL USING (
    public.is_super_admin()
) WITH CHECK (
    public.is_super_admin()
);

-- ------------------------------------------------------------------------------
-- 4. TRIGGER DE CRIAÇÃO AUTOMÁTICA DE PERFIL (auth.users -> profiles)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        role,
        approved,
        theme,
        language,
        summary_detail,
        default_mode,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'user',   -- Todo o utilizador nasce como 'user'
        FALSE,    -- Todo o utilizador nasce não aprovado
        'light',
        'portuguese',
        'detailed',
        'mic',
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. TRIGGER DE PROTEÇÃO E IMUTABILIDADE DE COLUNAS EM PROFILES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Se quem executa o UPDATE não for SUPER_ADMIN, impede alteração de campos sensíveis
    IF NOT public.is_super_admin() THEN
        NEW.role := OLD.role;
        NEW.approved := OLD.approved;
        NEW.id := OLD.id;
        NEW.email := OLD.email;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_profile_fields() TO authenticated, service_role;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS RLS PARA PROFILES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Utilizador lê o seu; Super-Admin lê todos
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    auth.uid() = id OR public.is_super_admin()
);

-- INSERT: Apenas a própria conta com role='user' e approved=false (ou Super-Admin)
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
    (auth.uid() = id AND role = 'user' AND approved = false)
    OR public.is_super_admin()
);

-- UPDATE: Utilizador atualiza campos permitidos do seu perfil; Super-Admin atualiza qualquer um
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id OR public.is_super_admin()
) WITH CHECK (
    auth.uid() = id OR public.is_super_admin()
);

-- DELETE: Reservado exclusivamente ao Super-Admin
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
    public.is_super_admin()
);

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS RLS PARA MEETINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- SELECT: Utilizador lê apenas as suas; Super-Admin audita e recupera todas
CREATE POLICY "meetings_select_policy" ON public.meetings
FOR SELECT USING (
    auth.uid() = user_id OR public.is_super_admin()
);

-- INSERT: Utilizador apenas insere com user_id igual ao seu auth.uid()
CREATE POLICY "meetings_insert_policy" ON public.meetings
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- UPDATE: Utilizador altera apenas as suas; Super-Admin tem permissão de recuperação global
CREATE POLICY "meetings_update_policy" ON public.meetings
FOR UPDATE USING (
    auth.uid() = user_id OR public.is_super_admin()
) WITH CHECK (
    auth.uid() = user_id OR public.is_super_admin()
);

-- DELETE: Utilizador elimina apenas as suas; Super-Admin pode purgar/gerir globalmente
CREATE POLICY "meetings_delete_policy" ON public.meetings
FOR DELETE USING (
    auth.uid() = user_id OR public.is_super_admin()
);

COMMIT;

-- ==============================================================================
-- BOOTSTRAP DO SUPER_ADMIN (SECÇÃO COMENTADA - AGUARDA CONFIRMAÇÃO DO UUID)
-- ==============================================================================
-- INSERT INTO public.admin_roles (user_id, role)
-- VALUES ('<UUID_CONFIRMADO>', 'super_admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
--
-- UPDATE public.profiles
-- SET role = 'super_admin', approved = TRUE
-- WHERE id = '<UUID_CONFIRMADO>';
