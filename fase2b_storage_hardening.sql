-- ==============================================================================
-- FASE 2B: HARDENING DE STORAGE E CONFIDENCIALIDADE DE ÁUDIO (TRANSACTIONAL)
-- ==============================================================================

BEGIN;

-- 1. GARANTIR VISIBILIDADE PRIVADA NOS BUCKETS DE ÁUDIO
UPDATE storage.buckets
SET public = FALSE
WHERE id IN ('meeting-audio-temp', 'meeting-audio-backups');

-- 2. LIMPEZA DINÂMICA DE POLICIES ESPECÍFICAS DOS BUCKETS DE ÁUDIO (SEM EFEITOS COLATERAIS)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND (
            qual ILIKE '%meeting-audio-temp%'
            OR qual ILIKE '%meeting-audio-backups%'
            OR with_check ILIKE '%meeting-audio-temp%'
            OR with_check ILIKE '%meeting-audio-backups%'
            OR policyname IN (
                'storage_temp_insert', 'storage_temp_select', 'storage_temp_delete',
                'storage_backups_insert', 'storage_backups_select', 'storage_backups_delete',
                'meeting_audio_temp_insert', 'meeting_audio_temp_select', 'meeting_audio_temp_delete',
                'meeting_audio_backups_insert', 'meeting_audio_backups_select', 'meeting_audio_backups_delete'
            )
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS PARA O BUCKET: meeting-audio-temp
-- -----------------------------------------------------------------------------

-- INSERT: Utilizador apenas envia na sua pasta e como owner_id
CREATE POLICY "storage_temp_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'meeting-audio-temp'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

-- SELECT: Utilizador apenas descarrega/assina os seus ficheiros temporários
CREATE POLICY "storage_temp_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'meeting-audio-temp'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

-- DELETE: Utilizador apenas remove os seus ficheiros temporários
CREATE POLICY "storage_temp_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'meeting-audio-temp'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

-- -----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS PARA O BUCKET: meeting-audio-backups
-- -----------------------------------------------------------------------------

-- INSERT: Apenas na própria pasta
CREATE POLICY "storage_backups_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'meeting-audio-backups'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

-- SELECT: Apenas o proprietário ou Super-Admin (Recuperação)
CREATE POLICY "storage_backups_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'meeting-audio-backups'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

-- DELETE: Apenas o proprietário ou Super-Admin
CREATE POLICY "storage_backups_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'meeting-audio-backups'
    AND (
        (
            (storage.foldername(name))[1] = (SELECT auth.uid()::text)
            AND owner_id = (SELECT auth.uid()::text)
        )
        OR public.is_super_admin()
    )
);

COMMIT;
