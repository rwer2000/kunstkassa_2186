-- Migratie: opschonen ten onrechte gekopieerde maatwerkrekeningen
-- Timestamp: 20260730161500
--
-- De backfill in 20260730160000_rekeningschema_per_gebruiker.sql kopieerde op
-- dit specifieke moment (deze database had inmiddels al maatwerkrekeningen,
-- niet alleen de 11 standaardrekeningen) ook 17 maatwerkrekeningen — met
-- specifieke klantnamen als 'Samson Aluin', 'De Broers van Arkel', 'HKU', en
-- persoonlijke kostencategorieën — naar alle gebruikers, terwijl die
-- rekeningen feitelijk alleen door één gebruiker worden gebruikt (te zien aan
-- boekingen.rekeningcode). Dat is precies het soort kruisbestuiving die met
-- de vorige migratie juist voorkomen moest worden.
--
-- Verwijder deze maatwerkrekeningen bij alle gebruikers behalve de
-- daadwerkelijke eigenaar; iedereen behoudt de 11 standaardrekeningen.
-- (Dit is een eenmalige opschoonactie specifiek voor deze database-inhoud,
-- niet nodig bij een verse database.)

DELETE FROM public.rekeningschema
WHERE gebruiker_id <> '2a71d16b-8088-48af-b903-503e7aef4591'
  AND code NOT IN ('1000','1500','1510','3000','4000','4100','4200','4300','4400','8000','9999');
