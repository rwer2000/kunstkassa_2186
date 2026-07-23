-- Migration: Beheer & Balans — vaste_activa + beginbalans tables
-- Timestamp: 20260723100000

-- 1. Create vaste_activa table
CREATE TABLE IF NOT EXISTS public.vaste_activa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gebruiker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    naam TEXT NOT NULL,
    rekeningcode TEXT NOT NULL REFERENCES public.rekeningschema(code),
    aanschafwaarde NUMERIC(14, 2) NOT NULL,
    aanschafdatum DATE NOT NULL,
    afschrijvingsduur_jaren INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for vaste_activa
CREATE INDEX IF NOT EXISTS idx_vaste_activa_gebruiker_id ON public.vaste_activa(gebruiker_id);
CREATE INDEX IF NOT EXISTS idx_vaste_activa_rekeningcode ON public.vaste_activa(rekeningcode);

-- 3. Enable RLS on vaste_activa
ALTER TABLE public.vaste_activa ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for vaste_activa (owner + is_admin exception)
DROP POLICY IF EXISTS "vaste_activa_user_own" ON public.vaste_activa;
CREATE POLICY "vaste_activa_user_own"
ON public.vaste_activa
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

-- 5. Create beginbalans table
CREATE TABLE IF NOT EXISTS public.beginbalans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gebruiker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rekeningcode TEXT NOT NULL REFERENCES public.rekeningschema(code),
    bedrag NUMERIC(14, 2) NOT NULL,
    datum DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Unique constraint: one beginbalans per user per rekening
CREATE UNIQUE INDEX IF NOT EXISTS idx_beginbalans_gebruiker_rekening
ON public.beginbalans (gebruiker_id, rekeningcode);

-- 7. Indexes for beginbalans
CREATE INDEX IF NOT EXISTS idx_beginbalans_gebruiker_id ON public.beginbalans(gebruiker_id);
CREATE INDEX IF NOT EXISTS idx_beginbalans_rekeningcode ON public.beginbalans(rekeningcode);
CREATE INDEX IF NOT EXISTS idx_beginbalans_datum ON public.beginbalans(datum);

-- 8. Enable RLS on beginbalans
ALTER TABLE public.beginbalans ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for beginbalans (owner + is_admin exception)
DROP POLICY IF EXISTS "beginbalans_user_own" ON public.beginbalans;
CREATE POLICY "beginbalans_user_own"
ON public.beginbalans
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
