-- Migration: Dubbel boekhouden — tegenrekening + saldo-berekening
-- Timestamp: 20260723083636

-- 1. Add 'tegenrekening' column to boekingen (FK to rekeningschema.code)
ALTER TABLE public.boekingen
ADD COLUMN IF NOT EXISTS tegenrekening TEXT REFERENCES public.rekeningschema(code);

CREATE INDEX IF NOT EXISTS idx_boekingen_tegenrekening ON public.boekingen(tegenrekening);

-- 2. Insert new rekeningen into rekeningschema
-- 'Eigen vermogen' category: Privé (code 3000)
-- 'Activa' category: Bank (code 1000)
INSERT INTO public.rekeningschema (code, naam, categorie, standaard_btw_percentage, actief)
VALUES
  ('3000', 'Privé', 'Eigen vermogen', NULL, true),
  ('1000', 'Bank', 'Activa', NULL, true)
ON CONFLICT (code) DO NOTHING;
