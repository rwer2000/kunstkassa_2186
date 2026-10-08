# Uitzoeken: naar enterprise-niveau

Uitgewerkt met marktonderzoek en adviezen in [`enterprise-advies.md`](enterprise-advies.md) (2026-10-08). Punt 2 is afgerond. Open onderzoekslijst, geen besluit. Aanleiding: op 2026-09-28 liep de gedeelde
Supabase-organisatie (Shedfinds — Sportlogging, congress-collector én
KunstKassa zitten er alle drie in) tegen de gratis Fair Use-limiet aan
(egress, veroorzaakt door een ander project), waardoor ook KunstKassa's
Supabase-API tijdelijk plat lag. Dat maakte een aantal groeivragen die er
toch al aankwamen acuut.

## 1. Supabase-plan en dimensionering

- Pro geeft (op moment van schrijven) een veel ruimere egress-toewijzing dan
  de 5 GB gratis — check het actuele cijfer op de Supabase pricing-pagina
  voordat je hier budget op vaststelt, dit soort limieten verandert.
- Losse observatie, geen zorg: de dagelijkse bonnetjes-/facturenverwerking
  zelf downloadt elk document precies één keer (zie `CLAUDE.md`'s protocol
  stap 3) — bij ~100 facturen à 1-2 pagina's is dat hooguit een paar honderd
  MB egress per ronde, niet de orde van grootte die de limiet deed
  omslaan. Egress-druk komt van elders (in dit geval: een historische
  eenmalige backfill in een ander project in dezelfde organisatie).
- 1 GB gratis Storage is voor een jaar groei (facturen + kwartaal-
  bankafschriften, multi-tenant, meerdere gebruikers) waarschijnlijk krap.
  Op Pro is dat ruimer — bepaal hoeveel, en of dat voor de verwachte
  gebruikersaantallen voldoende is voor de komende 12 maanden.

## 2. Eigen Supabase-organisatie per project

Nog los van het bovenstaande: Fair Use-restricties bleken te gelden op
**organisatieniveau**, niet per project (leeg-project-in-andere-org-test
bevestigde dit: 0 op alle tellers, terwijl de bestaande org al ver over de
egress-limiet zat). Zolang KunstKassa in dezelfde organisatie zit als
side-projects zoals congress-collector, kan een gratis-limiet-overschrijding
daar KunstKassa's productie-API weer platleggen. Overwegen: KunstKassa naar
een eigen Supabase-organisatie (kan onder hetzelfde account, geen nieuwe
login nodig), zeker zodra dit richting een betalend/zakelijk product gaat.

## 3. "Microsoft is veiliger om in op te slaan dan Cloudflare" — nuance nodig

Geen vaststaand feit: Cloudflare R2 is net zo goed SOC 2/ISO 27001-
gecertificeerd, versleutelt at-rest en ondersteunt privébuckets met scoped
toegang. Veiligheid zit in de **configuratie** (RLS/toegangscontrole, least-
privilege sleutels, private buckets, encryptie, dataresidentie), niet
automatisch in het merk. Wat wél een legitieme, niet-veiligheids-reden voor
Microsoft-consolidatie zou zijn: als facturen via Microsoft AI Builder
verwerkt gaan worden (zie punt 5), is alles binnen één tenant (Entra ID,
één factuur, één compliance-traject) een reëel operationeel voordeel.
Uitzoeken: weegt dat op tegen de overstapkosten, gegeven dat de huidige
Supabase Storage-opzet an sich prima voldoet als de configuratie klopt?

## 4. RLS en overige security, voor een enterprise-scenario

Huidige stand (uit `CLAUDE.md`'s datamodel): multi-tenant tabellen
(`documents`, `boekingen`, `bank_transacties`, `profielen`) met een
`user_id`/`gebruiker_id`-kolom, verwerkt door een los-draaiende Claude-sessie
die met de service-role-key alles leest (bewust ongefilterd op user_id, punt
0 van het protocol). Uit te zoeken voor een enterprise-versie:

- Staat er al RLS op deze tabellen voor het reguliere (niet-service-role)
  pad dat de webapp zelf gebruikt? Verifiëren, niet aannemen.
- Audit-logging: wie heeft wanneer welk document/boeking aangeraakt.
- Toegangscontrole voor een scenario met meerdere gebruikers per organisatie
  (bv. een boekhouder die voor meerdere ZZP'ers werkt) — huidige model lijkt
  1 gebruiker = 1 tenant; een accountant-met-meerdere-klanten-rol bestaat
  nog niet.
- Encryptie-eisen boven wat Supabase Storage al standaard doet, indien nodig
  voor een specifieke certificering.

## 5. Factuurverwerking: Claude-sessie vs. Microsoft AI Builder

Nu: een handmatig gestarte Claude Code-/Cowork-sessie, dagelijks, zonder
losse API-kosten (leest via de Read-tool, schrijft via Supabase MCP).
Microsoft AI Builder heeft kant-en-klare Invoice/Receipt-processing-modellen
die dit soort extractie automatisch (zonder handmatige sessie-start) zouden
kunnen doen. Uitzoeken: nauwkeurigheid vs. het huidige protocol, kosten per
verwerkte factuur op schaal, onderhoudslast, en of het huidige detailniveau
van het protocol (tegenrekening-logica, duplicaatcheck via hash, BTW-
behandeling) daarin te vangen is of dat er maatwerk nodig blijft.

## 6. Grotere architectuurvraag: AI en opslag loskoppelen van KunstKassa

Idee, nog volledig open: in plaats van dat KunstKassa zelf (via een Claude-
sessie) alle facturen voor alle gebruikers verwerkt, wordt het een dunnere
plugin-laag — gebruikers koppelen hun eigen AI-account (ChatGPT, Claude,
Gemini, ...) én hun eigen opslag (Google Drive of iets dergelijks), en
KunstKassa orkestreert alleen. Voor- en nadelen, allebei nog te wegen:

- Voordeel: geen centrale, handmatige dagelijkse verwerkingsstap meer nodig;
  kosten en verwerking verschuiven naar de gebruiker.
- Nadeel: een boekhoudtool leunt juist vaak op één centraal, controleerbaar
  systeem (auditability voor een boekhouder/accountant) — met opslag verspreid
  over gebruikers-eigen backends wordt dat lastiger. Ook: consistentie van
  verwerkingskwaliteit hangt dan af van welke AI de gebruiker toevallig kiest.

Dit raakt punt 3 en 4 direct: een centraal-opslag-model (huidige aanpak) en
een gebruikers-eigen-opslag-model vragen een heel ander RLS-/security-
ontwerp.
