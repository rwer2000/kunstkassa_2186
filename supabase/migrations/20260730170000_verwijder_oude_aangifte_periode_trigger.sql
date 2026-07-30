-- Migratie: verwijder oude aangifte_periode-trigger
-- Timestamp: 20260730170000
--
-- Bij de overstap naar het doorlopende BTW-saldo (aangifte_periode = NULL
-- totdat je indient, zie 20260730090000_backfill_openstaand_aangifte_periode.sql)
-- is destijds alleen de app-code aangepast (boekingenService.createBoeking
-- stuurt nu altijd aangifte_periode: null mee). Deze BEFORE INSERT-trigger
-- deed op database-niveau dezelfde per-datum periodetoewijzing en stond nog
-- gewoon aan — zonder deze fix zou elke nieuwe boeking alsnog automatisch
-- een periode krijgen en nooit meetellen in het openstaande saldo, wat de
-- hele redesign zou ondermijnen. Trigger + bijbehorende (nu ongebruikte)
-- functie weg.

DROP TRIGGER IF EXISTS trg_bepaal_aangifte_periode ON public.boekingen;
DROP FUNCTION IF EXISTS public.bepaal_aangifte_periode();
