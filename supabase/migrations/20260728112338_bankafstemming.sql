-- Migration: Bankafstemming — bank_transacties tabel + bron kolom op documents
-- Timestamp: 20260728112338

-- ─── 1. Enum: match_status ────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.bank_match_status CASCADE;
CREATE TYPE public.bank_match_status AS ENUM (
  'nog_te_matchen',
  'gematcht',
  'geen_factuur',
  'prive'
);

-- ─── 2. Tabel: bank_transacties ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_transacties (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gebruiker_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boekdatum        date NOT NULL,
  bedrag           numeric(10,2) NOT NULL,
  tegenpartij_naam text,
  tegenpartij_iban text,
  omschrijving     text,
  periode          text NOT NULL,
  match_status     public.bank_match_status NOT NULL DEFAULT 'nog_te_matchen',
  boeking_id       uuid REFERENCES public.boekingen(id) ON DELETE SET NULL,
  match_toelichting text,
  import_hash      text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Indexen ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bank_transacties_gebruiker_periode
  ON public.bank_transacties(gebruiker_id, periode);

CREATE INDEX IF NOT EXISTS idx_bank_transacties_match_status
  ON public.bank_transacties(match_status);

-- Unieke import_hash per gebruiker (deduplicatie)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transacties_hash_gebruiker
  ON public.bank_transacties(gebruiker_id, import_hash);

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.bank_transacties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_bank_transacties" ON public.bank_transacties;
CREATE POLICY "users_manage_own_bank_transacties"
  ON public.bank_transacties
  FOR ALL
  TO authenticated
  USING (gebruiker_id = auth.uid())
  WITH CHECK (gebruiker_id = auth.uid());

-- ─── 5. Kolom bron op documents ──────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS bron text NOT NULL DEFAULT 'upload';
