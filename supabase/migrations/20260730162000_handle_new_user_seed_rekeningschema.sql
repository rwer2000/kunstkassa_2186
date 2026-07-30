-- Migratie: handle_new_user() zaait ook rekeningschema
-- Timestamp: 20260730162000
--
-- Nu rekeningschema per gebruiker geïsoleerd is (zie
-- 20260730160000_rekeningschema_per_gebruiker.sql), moet een nieuwe
-- gebruiker bij signup ook meteen zijn eigen kopie van de 11
-- standaardrekeningen krijgen — voorheen bestond er 1 gedeelde tabel, dus
-- dit gebeurde impliciet.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profielen (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rekeningschema (gebruiker_id, code, naam, categorie, standaard_btw_percentage, actief)
  VALUES
    (NEW.id, '1000', 'Bank', 'Activa', NULL, true),
    (NEW.id, '1500', 'Te betalen BTW', 'BTW', NULL, true),
    (NEW.id, '1510', 'Te vorderen BTW', 'BTW', NULL, true),
    (NEW.id, '3000', 'Privé', 'Eigen vermogen', NULL, true),
    (NEW.id, '4000', 'Inkopen / kosten leveranciers', 'Kosten', 21, true),
    (NEW.id, '4100', 'Kantoorkosten', 'Kosten', 21, true),
    (NEW.id, '4200', 'Reiskosten', 'Kosten', 21, true),
    (NEW.id, '4300', 'Marketing en representatie', 'Kosten', 21, true),
    (NEW.id, '4400', 'Software en abonnementen', 'Kosten', 21, true),
    (NEW.id, '8000', 'Omzet verkopen', 'Omzet', 21, true),
    (NEW.id, '9999', 'Overig', 'Overig', NULL, true)
  ON CONFLICT (gebruiker_id, code) DO NOTHING;

  RETURN NEW;
END;
$function$;
