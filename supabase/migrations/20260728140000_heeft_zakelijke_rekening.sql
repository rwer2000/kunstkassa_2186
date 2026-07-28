-- Migration: Zakelijke bankrekening toggle
-- Timestamp: 20260728140000
--
-- Niet elke ZZP'er heeft een zakelijke bankrekening. Voor gebruikers zonder
-- zakelijke rekening is de Bankafstemming-feature niet relevant (er zijn
-- geen bankafschriften) en moet elke boeking altijd tegenrekening 'Privé'
-- krijgen zonder de "overduidelijk zakelijk"-heuristiek. Zie CLAUDE.md,
-- protocol voor het dagelijks verwerken van bonnetjes en protocol
-- kwartaal-bankafstemming.
--
-- Default false: sluit aan bij de bestaande aanname dat de meeste
-- ZZP'ers geen zakelijke rekening hebben.

ALTER TABLE public.profielen
  ADD COLUMN IF NOT EXISTS heeft_zakelijke_rekening BOOLEAN NOT NULL DEFAULT false;
