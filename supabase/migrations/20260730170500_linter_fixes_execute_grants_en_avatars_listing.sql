-- Migratie: security-linter fixes (EXECUTE-rechten + avatars-listing)
-- Timestamp: 20260730170500
--
-- Twee losse, risicovrije fixes uit de Supabase security-linter.

-- 1. handle_new_user() is een trigger-functie (draait alleen via
--    on_auth_user_created) en is_admin_user() is een interne helper die
--    alleen binnen RLS-policies wordt gebruikt. Beide stonden nog gewoon
--    rechtstreeks aanroepbaar via de REST/RPC-API voor anon en
--    authenticated — nergens voor nodig, dus EXECUTE weghalen.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon, authenticated;

-- 2. De 'avatars'-bucket is een publieke bucket: directe object-URL's werken
--    sowieso zonder RLS te raadplegen. De losse SELECT-policy op
--    storage.objects was dus alleen nodig om de hele bucket te kunnen
--    listen/enumereren (en daarmee user-ID's uit avatar-bestandspaden af te
--    leiden) — weg ermee, avatar-URL's blijven gewoon werken.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
