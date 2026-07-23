-- Migration: Security hardening
-- Timestamp: 20260723120000
--
-- Fixes:
-- 1. Privilege escalation — voorheen kon elke ingelogde gebruiker via RLS zijn
--    eigen profielrij updaten inclusief de kolom `is_admin`, en zichzelf zo tot
--    admin promoveren. We trekken de brede INSERT/UPDATE-rechten in en geven
--    alleen kolom-specifieke rechten terug (zonder `is_admin`). `is_admin` kan
--    daarna alleen nog server-side (service role) gezet worden.
-- 2. SECURITY DEFINER functies met mutable search_path — vastgezet op ''.

-- 1. Privilege escalation dichtzetten
REVOKE INSERT, UPDATE ON public.profielen FROM anon, authenticated;

GRANT INSERT (id, naam, email, avatar_path, updated_at)
   ON public.profielen TO authenticated;

GRANT UPDATE (naam, email, avatar_path, updated_at)
   ON public.profielen TO authenticated;

-- 2. search_path hardening voor SECURITY DEFINER functies
ALTER FUNCTION public.is_admin_user() SET search_path = '';
ALTER FUNCTION public.hook_restrict_signup_to_allowlist(jsonb) SET search_path = '';
