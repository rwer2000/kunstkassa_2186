-- Migration: Automatisch profiel aanmaken bij signup
-- Timestamp: 20260729153000
--
-- Voorheen werd een profielen-rij alleen aangemaakt zodra een gebruiker naar
-- Instellingen ging en op Opslaan klikte. Een gebruiker die alleen
-- documenten uploadt (en nooit Instellingen bezoekt) had dan geen profiel —
-- waardoor het Claude-verwerkingsprotocol (stap 0: heeft_zakelijke_rekening
-- ophalen) die gebruiker kon missen.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profielen (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: bestaande gebruikers zonder profielrij alsnog voorzien van een profiel.
INSERT INTO public.profielen (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profielen p ON p.id = u.id
WHERE p.id IS NULL;
