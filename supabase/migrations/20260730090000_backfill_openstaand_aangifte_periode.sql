-- Migratie: backfill aangifte_periode voor het doorlopend-BTW-saldo-model
-- Timestamp: 20260730090000
--
-- Onder het oude systeem kreeg elke boeking bij aanmaken meteen een
-- aangifte_periode op basis van de factuurdatum, ook al was dat kwartaal
-- nooit daadwerkelijk ingediend. Sinds de overstap naar een doorlopend
-- BTW-saldo betekent aangifte_periode = NULL "nog niet ingediend, telt
-- mee in het openstaande saldo". Zonder deze backfill zouden bestaande
-- boekingen ten onrechte buiten het openstaande saldo blijven, terwijl
-- ze nooit echt zijn ingediend.
--
-- Zet aangifte_periode terug naar NULL voor elke boeking wiens periode
-- geen corresponderende 'ingediend' rij in btw_kwartalen heeft.

UPDATE public.boekingen b
SET aangifte_periode = NULL
WHERE b.aangifte_periode IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.btw_kwartalen k
    WHERE k.gebruiker_id = b.gebruiker_id
      AND k.periode = b.aangifte_periode
      AND k.status = 'ingediend'
  );
