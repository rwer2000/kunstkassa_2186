-- Migration: BTW-aangifte per kwartaal
-- Timestamp: 20260722200000

-- 1. Create btw_kwartaal_status enum
DROP TYPE IF EXISTS public.btw_kwartaal_status CASCADE;
CREATE TYPE public.btw_kwartaal_status AS ENUM ('open', 'ingediend');

-- 2. Create btw_kwartalen table
CREATE TABLE IF NOT EXISTS public.btw_kwartalen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gebruiker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    periode TEXT NOT NULL,
    status public.btw_kwartaal_status NOT NULL DEFAULT 'open'::public.btw_kwartaal_status,
    ingediend_bedrag NUMERIC(12, 2),
    ingediend_op TIMESTAMPTZ,
    brondocument_pad TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Unique constraint: one row per user per period
CREATE UNIQUE INDEX IF NOT EXISTS idx_btw_kwartalen_gebruiker_periode
ON public.btw_kwartalen (gebruiker_id, periode);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_btw_kwartalen_gebruiker_id ON public.btw_kwartalen(gebruiker_id);
CREATE INDEX IF NOT EXISTS idx_btw_kwartalen_periode ON public.btw_kwartalen(periode);

-- 5. Add aangifte_periode column to boekingen (if not exists)
ALTER TABLE public.boekingen
ADD COLUMN IF NOT EXISTS aangifte_periode TEXT;

CREATE INDEX IF NOT EXISTS idx_boekingen_aangifte_periode ON public.boekingen(aangifte_periode);

-- 6. Enable RLS on btw_kwartalen
ALTER TABLE public.btw_kwartalen ENABLE ROW LEVEL SECURITY;

-- 7. Helper function: check if current user is admin (uses profielen.is_admin)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT COALESCE(
    (SELECT is_admin FROM public.profielen WHERE id = auth.uid() LIMIT 1),
    false
)
$$;

-- 8. RLS Policies for btw_kwartalen
-- Users see/manage their own rows; admins see/manage all rows
DROP POLICY IF EXISTS "btw_kwartalen_user_own" ON public.btw_kwartalen;
CREATE POLICY "btw_kwartalen_user_own"
ON public.btw_kwartalen
FOR ALL
TO authenticated
USING (
    gebruiker_id = auth.uid()
    OR public.is_admin_user()
)
WITH CHECK (
    gebruiker_id = auth.uid()
    OR public.is_admin_user()
);

-- 9. Storage bucket for BTW aangiften PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'btw-aangiften',
    'btw-aangiften',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 10. Storage RLS policies for btw-aangiften bucket
DROP POLICY IF EXISTS "btw_aangiften_user_upload" ON storage.objects;
CREATE POLICY "btw_aangiften_user_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'btw-aangiften'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "btw_aangiften_user_read" ON storage.objects;
CREATE POLICY "btw_aangiften_user_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'btw-aangiften'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_admin_user()
    )
);

DROP POLICY IF EXISTS "btw_aangiften_user_delete" ON storage.objects;
CREATE POLICY "btw_aangiften_user_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'btw-aangiften'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_admin_user()
    )
);
