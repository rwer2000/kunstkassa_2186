-- Migration: Documents Storage for KunstKassa
-- Creates storage bucket and documents table linked to authenticated users

-- 1. Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    bucket_name TEXT NOT NULL DEFAULT 'documents',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_documents" ON public.documents;
CREATE POLICY "users_manage_own_documents"
ON public.documents
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS policies
DROP POLICY IF EXISTS "users_upload_own_documents" ON storage.objects;
CREATE POLICY "users_upload_own_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_read_own_documents" ON storage.objects;
CREATE POLICY "users_read_own_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_delete_own_documents" ON storage.objects;
CREATE POLICY "users_delete_own_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
