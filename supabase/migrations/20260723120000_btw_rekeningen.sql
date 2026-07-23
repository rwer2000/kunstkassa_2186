-- Migration: BTW als aparte rekeningen op de Balans
-- Timestamp: 20260723120000

-- Insert BTW rekeningen into rekeningschema
-- categorie 'BTW' (already exists as a valid value in the app)
INSERT INTO public.rekeningschema (code, naam, categorie, standaard_btw_percentage, actief)
VALUES
  ('1500', 'Te betalen BTW', 'BTW', NULL, true),
  ('1510', 'Te vorderen BTW', 'BTW', NULL, true)
ON CONFLICT (code) DO NOTHING;
