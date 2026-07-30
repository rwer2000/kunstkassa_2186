-- Migratie: rekeningschema isoleren per gebruiker
-- Timestamp: 20260730160000
--
-- rekeningschema was tot nu toe 1 globale tabel zonder gebruiker_id, met een
-- RLS-policy die iedereen (zelfs niet-ingelogd) alles liet lezen. Dat botst
-- met de eis dat gebruikers volledig van elkaar gescheiden moeten zijn — dit
-- is boekhoudkundige info en mag nooit tussen gebruikers kruisen.
--
-- Elke gebruiker krijgt een eigen kopie van de huidige 11 standaardrekeningen,
-- FK's van boekingen/vaste_activa/beginbalans worden samengestelde sleutels
-- (gebruiker_id, code) i.p.v. alleen code, en RLS wordt owner-only.

ALTER TABLE public.rekeningschema
  ADD COLUMN IF NOT EXISTS gebruiker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.beginbalans DROP CONSTRAINT IF EXISTS beginbalans_rekeningcode_fkey;
ALTER TABLE public.boekingen DROP CONSTRAINT IF EXISTS boekingen_rekeningcode_fkey;
ALTER TABLE public.boekingen DROP CONSTRAINT IF EXISTS boekingen_tegenrekening_fkey;
ALTER TABLE public.vaste_activa DROP CONSTRAINT IF EXISTS vaste_activa_rekeningcode_fkey;

ALTER TABLE public.rekeningschema DROP CONSTRAINT IF EXISTS rekeningschema_pkey;

-- Elke bestaande gebruiker (elke rij in profielen) krijgt een eigen kopie van
-- de rijen die nog geen eigenaar hebben (de oude globale standaardrekeningen).
INSERT INTO public.rekeningschema (gebruiker_id, code, naam, categorie, standaard_btw_percentage, actief)
SELECT p.id, r.code, r.naam, r.categorie, r.standaard_btw_percentage, r.actief
FROM public.profielen p
CROSS JOIN public.rekeningschema r
WHERE r.gebruiker_id IS NULL;

DELETE FROM public.rekeningschema WHERE gebruiker_id IS NULL;

ALTER TABLE public.rekeningschema ALTER COLUMN gebruiker_id SET NOT NULL;
ALTER TABLE public.rekeningschema ADD CONSTRAINT rekeningschema_pkey PRIMARY KEY (gebruiker_id, code);

ALTER TABLE public.beginbalans
  ADD CONSTRAINT beginbalans_rekeningcode_fkey
  FOREIGN KEY (gebruiker_id, rekeningcode) REFERENCES public.rekeningschema (gebruiker_id, code);

ALTER TABLE public.boekingen
  ADD CONSTRAINT boekingen_rekeningcode_fkey
  FOREIGN KEY (gebruiker_id, rekeningcode) REFERENCES public.rekeningschema (gebruiker_id, code);

ALTER TABLE public.boekingen
  ADD CONSTRAINT boekingen_tegenrekening_fkey
  FOREIGN KEY (gebruiker_id, tegenrekening) REFERENCES public.rekeningschema (gebruiker_id, code);

ALTER TABLE public.vaste_activa
  ADD CONSTRAINT vaste_activa_rekeningcode_fkey
  FOREIGN KEY (gebruiker_id, rekeningcode) REFERENCES public.rekeningschema (gebruiker_id, code);

DROP POLICY IF EXISTS "iedereen_mag_rekeningschema_lezen" ON public.rekeningschema;
CREATE POLICY "gebruikers_beheren_eigen_rekeningschema"
ON public.rekeningschema
FOR ALL
TO authenticated
USING (gebruiker_id = auth.uid())
WITH CHECK (gebruiker_id = auth.uid());

-- De blanket-backfill hierboven kopieert bij een verse database keurig alleen
-- de standaardrekeningen (er bestaan dan nog geen maatwerkrekeningen). Was
-- deze migratie draait tegen een bestaande database met al maatwerkrekeningen
-- (aangemaakt via /beheer of het bonnetjes-protocol), verwijder die dan
-- achteraf bij iedereen behalve de daadwerkelijke eigenaar — zie de losse
-- opschoon-migratie die na deze migratie is toegepast op de live database
-- (20260730161500_rekeningschema_opschonen_maatwerk.sql). Nieuw aangemaakte
-- databases (lege profielen-tabel) hebben dat probleem niet.
