-- ==============================================================================
-- FASE 2B HOTFIX: CORREÇÃO DE RLS EM STORAGE.OBJECTS (ISOLAMENTO POR PATH)
-- ==============================================================================

BEGIN;

-- 1. GARANTIR BUCKETS PRIVADOS
UPDATE storage.buckets
SET public = FALSE
WHERE id IN ('meeting-audio-temp', 'meeting-audio-backups');

-- 2. LIMPAR POLICIES ANTERIORES DOS BUCKETS DE ÁUDIO
DROP POLICY IF EXISTS "storage_temp_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_temp_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_temp_delete" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_temp_insert" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_temp_select" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_temp_delete" ON storage.objects;

DROP POLICY IF EXISTS "storage_backups_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_backups_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_backups_delete" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_backups_insert" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_backups_select" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_backups_delete" ON storage.objects;

-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS PARA O BUCKET: meeting-audio-temp (ISOLAMENTO POR PATH)
-- -----------------------------------------------------------------------------

-- INSERT: Utilizador apenas envia para a sua própria pasta <user_id>/...
CREATE POLICY "storage_temp_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'meeting-audio-temp'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

-- SELECT: Utilizador apenas lê e assina URLs (createSignedUrl) da sua pasta <user_id>/...
CREATE POLICY "storage_temp_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'meeting-audio-temp'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

-- DELETE: Utilizador apenas remove ficheiros da sua pasta <user_id>/...
CREATE POLICY "storage_temp_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'meeting-audio-temp'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

-- -----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS PARA O BUCKET: meeting-audio-backups (ISOLAMENTO POR PATH)
-- -----------------------------------------------------------------------------

-- INSERT: Utilizador apenas envia backups para a sua própria pasta <user_id>/...
CREATE POLICY "storage_backups_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'meeting-audio-backups'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

-- SELECT: Utilizador apenas descarrega/recupera da sua pasta <user_id>/... ou Super-Admin
CREATE POLICY "storage_backups_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'meeting-audio-backups'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

-- DELETE: Utilizador apenas apaga backups da sua pasta <user_id>/... ou Super-Admin
CREATE POLICY "storage_backups_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'meeting-audio-backups'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        OR public.is_super_admin()
    )
);

COMMIT;
