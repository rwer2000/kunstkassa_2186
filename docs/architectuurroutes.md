# Drie architectuurroutes voor KunstKassa

Uitwerking van punt 3, 5 en 6 uit `enterprise-roadmap.md`. Stand: 2026-09-29.
Geen besluit; wel een advies onderaan.

**Bronnen prijzen** (opgehaald 2026-09-29): supabase.com/pricing,
developers.cloudflare.com/r2/pricing, learn.microsoft.com/ai-builder/credit-management.
Bedragen in USD, tenzij anders vermeld. Alles gemarkeerd met *(indicatief)* is
niet uit een bron gehaald en moet je nog nakijken voordat je budget vaststelt.

## Rekenmodel (aannames, pas aan)

Uit de huidige data: 154 documenten voor 4 gebruikers. Aannames per klant (ZZP'er):

- 150 documenten per jaar, gemiddeld 1 MB, gemiddeld 1,5 pagina
- Schaal S = 25 klanten, schaal L = 250 klanten
- Opslag na 1 jaar: S ≈ 4 GB, L ≈ 38 GB (groeit ~lineair per jaar; fiscale bewaarplicht 7 jaar, dus L komt na 7 jaar op ~260 GB)
- Documenten per jaar: S ≈ 3.750, L ≈ 37.500 (≈ 5.600 / 56.000 pagina's)

## Route A — Cloudflare R2 (opslag) + Supabase (database, auth)

### Technisch
- Supabase blijft: Postgres, auth, RLS, `boekingen` enz. Alleen de bestanden verhuizen naar R2 (S3-compatibel).
- **Wat je verliest:** Supabase Storage-policies (RLS op bucket). Toegangscontrole verhuist naar app-code: een Next.js API-route controleert de sessie en geeft een korte-levensduur presigned URL uit. Dat is de belangrijkste security-aandachtspunt: één fout in die route = alle klantdocumenten open.
- Upload: browser → presigned PUT naar R2 (niet via Vercel, dat bespaart functie-tijd).
- Migratie: 154 objecten (nu) kopiëren, `file_path`/`bucket_name` in `documents` aanpassen, signed-URL-code in `documentService.ts` vervangen. Klein werk (ordegrootte enkele dagen, incl. test).
- Claude-sessie/protocol: stap 3 haalt bestanden nu via Supabase Storage API. Moet naar R2 (S3-API, aparte read-only sleutel). Overige protocol ongewijzigd.
- Verwerking (AI): ongewijzigd, handmatige Claude-sessie, of later Claude API in een cron/queue voor automatisch.

### Kosten
| Post | S (25 klanten) | L (250 klanten) |
|---|---|---|
| Supabase Pro (incl. $10 compute-credit, 250 GB egress) | $25/mnd | $25/mnd; mogelijk een grotere compute-instance (Micro is krap bij 250 actieve gebruikers, *indicatief* +$10–60) |
| R2 opslag ($0,015/GB/mnd, 10 GB gratis) | $0 (4 GB) | ~$0,40/mnd jaar 1, ~$4/mnd jaar 7 |
| R2 egress | $0 | $0 |
| R2 operaties (gratis tier ruim genoeg) | $0 | ~$0 |
| Vercel | eigen plan (Pro $20/mnd per seat, *indicatief*) | idem |
| AI-verwerking | $0 (handmatige sessie) of Claude API ≈ $0,01–0,03 per document *(indicatief, meten op eigen bonnetjes)* → ~$40–110/jaar | ~$400–1.100/jaar |
| **Totaal infra** | **≈ $25–50/mnd** | **≈ $30–100/mnd** |

**Eerlijke kanttekening:** op deze schaal levert R2 vrijwel niets op boven Supabase Storage. De Pro-toewijzing dekt egress ruim (250 GB) en overschrijding is $0,125/GB opslag (disk) en $0,09/GB egress. Het echte voordeel van R2 is *ontkoppeling* (opslag onafhankelijk van Supabase, geen egress-verrassingen, makkelijk later te verplaatsen), niet de prijs. Controleer bij Supabase ook wat de file-storage-quota is naast de 8 GB database-disk; dat cijfer stond niet op de pricing-pagina.

### In de praktijk voor de klant
- Verandert niets zichtbaars: dezelfde app, login, camera-upload.
- Bonnetjes staan op servers van KunstKassa (Cloudflare, EU-regio te kiezen), boekingen bij Supabase.
- Klant betaalt een abonnement aan KunstKassa; de kosten per klant zijn een paar cent tot euro's per maand, dus er is ruimte voor een laag tarief.
- Boekhouder-toegang: vooralsnog via export/uitnodiging in KunstKassa (rol bestaat nog niet, zie roadmap punt 4).
- Data-eigendom: klant vraagt export aan bij KunstKassa. Klant is afhankelijk van jou voor beschikbaarheid.

## Route B — Volledig Microsoft

### Technisch
Bouwstenen: Entra ID (of Entra External ID voor klanten), Azure Blob Storage of SharePoint/OneDrive, Azure SQL of Dataverse, Azure Document Intelligence of AI Builder voor extractie, Power Automate voor orkestratie, hosting op Azure App Service/Static Web Apps in plaats van Vercel.

- **Reikwijdte is een herbouw van de backend**, niet een migratie: Supabase-auth, RLS en de client (`@supabase/ssr`) vervangen door Entra + eigen autorisatielaag (Azure SQL kent RLS, maar zonder Supabase's koppeling aan de ingelogde gebruiker; `SESSION_CONTEXT` handmatig zetten). Schatting: weken tot maanden werk, geen dagen.
- Extractie: Document Intelligence heeft prebuilt invoice/receipt-modellen; 500 pagina's/maand gratis. Prijs per pagina stond niet op de opgehaalde pagina; circa $10 per 1.000 pagina's *(indicatief, check calculator)*. Het huidige protocol (tegenrekening-logica, "schat nooit een ontbrekend veld", BTW-behandeling, duplicaat op hash) is business-logica die je zelf in code moet bouwen ná de extractie; een extractiemodel geeft velden, geen boekingsbeslissingen. Een LLM-stap blijft dus waarschijnlijk nodig voor rekeningcode en omschrijving.
- **Belangrijk voor AI Builder (uit Microsoft Learn, bijgewerkt 2026-01-14):** nieuwe klanten kunnen de AI Builder-capaciteitsadd-on niet meer kopen; het gaat via Copilot Credits. Meegeleverde AI Builder-credits in Power Apps/Automate-licenties vervallen op **1 november 2026**. Dus AI Builder als basis kiezen is nu een bewegend doel. Document Intelligence rechtstreeks via Azure is stabieler.
- Als een Power App de AI Builder-actie bevat, wordt die een premium app (licentie per gebruiker); een flow niet.

### Kosten
| Post | S | L |
|---|---|---|
| Blob-opslag (*indicatief* ~$0,02/GB/mnd) | ~$0 | ~$1–5/mnd |
| Document Intelligence (~$10/1.000 pag.) | ~$56/jaar | ~$560/jaar |
| Database (Azure SQL basic/Dataverse) | *indicatief* $5–15/mnd | *indicatief* $15–150/mnd |
| Hosting (App Service) | *indicatief* $13–55/mnd | *indicatief* $55–150/mnd |
| Licenties als je Power Platform gebruikt (Power Automate Premium $15/gebruiker/mnd *indicatief*) | alleen voor beheerders, niet per klant | idem |
| LLM-stap voor boekingsbeslissing | zie route A | zie route A |
| **Totaal infra** | **≈ $25–90/mnd** | **≈ $100–400/mnd** |

De variabele kosten zijn laag; de reële kostenpost is **ontwikkeltijd en licentiecomplexiteit**, niet de maandrekening.

### In de praktijk voor de klant
- Logt in met Microsoft-account of eigen tenant. Aantrekkelijk voor klanten die al M365 hebben; voor de gemiddelde ZZP'er een extra drempel.
- Voor een klant met een eigen tenant (accountantskantoor, MKB): documenten kunnen in *hun* SharePoint/OneDrive staan met hun eigen compliance-beleid. Dit is het sterkste verkoopargument richting enterprise.
- Eén leverancier, één factuur, één compliance-traject (SOC 2/ISO 27001 en dataresidentie EU-regio zijn standaard beschikbaar).
- Nadeel: minder wendbaar voor jou, je bent afhankelijk van Microsoft-licentiewijzigingen (zie AI Builder hierboven).

## Route C — Alles bij de klant (bring your own AI + eigen opslag)

### Technisch
- KunstKassa wordt orkestratielaag: klant koppelt Google Drive/OneDrive (OAuth) en een AI-account; documenten blijven in hún map; KunstKassa bewaart alleen metadata en boekingen (of zelfs die in hun eigen spreadsheet/database).
- **Grootste technische valkuil:** een ChatGPT/Claude/Gemini-*abonnement* is geen API-toegang. Automatische verwerking op de achtergrond vereist een API-sleutel (pay-per-use) die de klant aanmaakt en aan KunstKassa geeft. Dat is voor een ZZP'er een grote stap en het opslaan van de sleutel is een securityverantwoordelijkheid (versleutelen, roteren, nooit loggen). Alternatief: klant draait zelf een sessie (zoals nu bij jou); dat schaalt niet.
- Drive-koppeling: gebruik de smalle scope `drive.file` (alleen bestanden die de app aanmaakt/de gebruiker kiest) om zware Google-verificatie te vermijden; bredere scopes vereisen een beveiligingsbeoordeling. Refresh-tokens versleuteld opslaan en per klant kunnen intrekken.
- Kwaliteitsconsistentie: elke klant kiest een ander model; je moet extractiekwaliteit per provider testen en een minimale set ondersteunen (bv. alleen Claude en OpenAI).
- Auditability: bronbestanden staan verspreid; KunstKassa moet per boeking een verwijzing + hash bewaren om een boekhouder/Belastingdienst-controle aan te kunnen. Weinig controle als de klant het bestand verplaatst of verwijdert (bewaarplicht 7 jaar ligt dan bij de klant).
- RLS-ontwerp: veel eenvoudiger (jij bewaart minder), maar tokenbeheer en gebruikerssleutels worden het nieuwe risico.

### Kosten
| Post | Voor jou (S / L) | Voor de klant |
|---|---|---|
| Supabase (alleen metadata/auth) | $0–25/mnd (Free volstaat mogelijk voor S, maar 1 week inactiviteit = pauze; Pro is verstandiger) | – |
| Opslag | $0 | eigen Drive/OneDrive (vaak al betaald; 15 GB gratis bij Google) |
| AI-verwerking | $0 | API-kosten ≈ $1,5–4,5/jaar per klant bij 150 docs à $0,01–0,03 *(indicatief)*; + abonnement dat ze evt. al hebben |
| Hosting | Vercel | – |
| **Totaal infra** | **≈ $20–50/mnd, vrijwel onafhankelijk van klantaantal** | **≈ $0,3–1/mnd aan API-kosten** |

Goedkoopste route voor jou, maar de kosten verschuiven naar support en risico (kapotte tokens, lege API-tegoeden, verwijderde bestanden).

### In de praktijk voor de klant
- Onboarding: account maken → Drive koppelen → AI-sleutel plakken → betaaltegoed bij AI-provider regelen. Vier stappen in plaats van één; verwacht uitval in de onboarding.
- De klant houdt fysiek eigenaarschap van bonnetjes; sterkste privacy-verhaal ("wij bewaren jouw documenten niet").
- Als het misgaat (sleutel verlopen, tegoed op, map verplaatst) merkt de klant dat pas als boekingen niet meer binnenkomen. Er is meer proactieve monitoring nodig.
- Boekhouder krijgt via deelrechten op de Drive-map toegang; dat is beheer door de klant, niet door jou.

## Vergelijking

| | A: R2 + Supabase | B: Full Microsoft | C: Alles bij klant |
|---|---|---|---|
| Bouwinspanning vanaf nu | klein | zeer groot (backend-herbouw) | groot (OAuth, sleutelbeheer, meerdere AI-providers) |
| Maandkosten jou, 25 klanten | ~$25–50 | ~$25–90 | ~$20–50 |
| Maandkosten jou, 250 klanten | ~$30–100 | ~$100–400 | ~$20–50 |
| Kosten voor klant | via abonnement | via abonnement | eigen API/Drive-kosten |
| Auditability/controle | hoog (centraal) | hoog (centraal, in tenant) | laag-gemiddeld |
| Security-risico zit in | presign-route + sleutelbeheer | Entra/tenant-config | tokens + klantsleutels |
| Onboarding klant | 1 stap | 1–2 stappen (M365) | 4 stappen |
| Externe afhankelijkheid | Supabase + Cloudflare | Microsoft (licentiewijzigingen) | Google/Microsoft + AI-provider(s) |
| Past bij | ZZP'er-abonnement | MKB/accountant met M365 | privacy-gevoelige power users |

## Advies

1. **Nu: route A, maar begin met alleen Supabase Pro.** Dat lost het acute probleem op (eigen org is al gedaan, Pro geeft egress/compute ruimte). Voeg R2 pas toe als opslag of egress een reële kostenpost wordt, of als je opslag bewust wilt ontkoppelen. Het bespaart geld pas ver na schaal L.
2. **Automatisering:** vervang de handmatige sessie door de Claude API in een geplande job (Supabase Edge Function of Vercel cron) voordat je verder schaalt. Dit is de echte hefboom op klantaantal, meer dan opslag.
3. **Route B alleen op vraag:** kies dit als je een concrete klant hebt (accountantskantoor met M365) die het eist. Eerst validatie, daarna bouwen. Vermijd AI Builder als fundament gezien de licentiewijziging per 1 november 2026.
4. **Route C als optionele extra**, niet als basis: bijvoorbeeld "koppel je eigen Drive als back-up" en "gebruik je eigen API-sleutel" voor power users. Als vervanging van de centrale opslag maakt het auditability zwakker.

## Open vragen voor jou
- Wat is de doelgroep: alleen ZZP'ers, of ook accountants/MKB?
- Wil je bewaarplicht (7 jaar) en export zelf garanderen, of bij de klant leggen?
- Ambitie voor klantaantal in 12 maanden (S of L)?
- Welke EU-dataresidentie-eisen hebben je klanten?
