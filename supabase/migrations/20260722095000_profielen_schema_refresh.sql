-- Migration: Force schema cache refresh for profielen table
-- Timestamp: 20260722095000

-- Re-ensure profielen table exists with all columns (idempotent)
CREATE TABLE IF NOT EXISTS public.profielen (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    naam TEXT,
    email TEXT,
    avatar_path TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Re-ensure index
CREATE INDEX IF NOT EXISTS idx_profielen_id ON public.profielen(id);

-- Re-enable RLS (idempotent)
ALTER TABLE public.profielen ENABLE ROW LEVEL SECURITY;

-- Re-apply RLS policy
DROP POLICY IF EXISTS "users_manage_own_profielen" ON public.profielen;
CREATE POLICY "users_manage_own_profielen"
ON public.profielen
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Re-ensure avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Re-apply storage RLS policies
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
