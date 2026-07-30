# KunstKassa

Webapp waar ZZP'ers bonnetjes/facturen uploaden (bij voorkeur via de camera
op hun telefoon), die vervolgens door een Claude Cowork-sessie worden
verwerkt tot boekingen in het grootboek. Next.js + Supabase (auth, database,
storage) + Vercel.

## Protocol voor het dagelijks verwerken van bonnetjes

Dit draait de gebruiker zelf (bv. 1x per dag) door een Claude Code-sessie te
openen met de Supabase MCP-server gekoppeld (project-ref
`lsrhodkjceemgcnjogwl`). Geen losse API-kosten nodig: Claude leest de
bonnetjes/facturen zelf via de Read-tool, en leest/schrijft de database via
de Supabase MCP-tools.

0. Haal via de Supabase MCP alle rijen op uit `documents` met
   `doc_status = 'nog_te_verwerken'`. **Filter hier niet op user_id/
   gebruiker_id** — dit is een multi-tenant app, dus dit kunnen
   documenten van meerdere gebruikers tegelijk zijn (bv. jijzelf én een
   neef/kennis die ook een account heeft). Verwerk ze allemaal in dezelfde
   sessie.
1. Haal voor elke unieke gebruiker_id/user_id uit die documenten de rij
   op uit `profielen` (op `id`). **Bestaat er geen profielrij voor die
   gebruiker** (kan gebeuren als iemand alleen upload en nooit naar
   Instellingen is geweest — hoort dankzij de signup-trigger inmiddels
   niet meer voor te komen, maar behandel het defensief): ga dan uit van
   `heeft_zakelijke_rekening = false`, net als de default in de app. Sla
   die gebruiker nooit over vanwege een ontbrekend profiel.
   Dit bepaalt hoe je stap 5 hieronder invult (zie daar) en of het
   protocol "kwartaal-bankafstemming" verderop voor die gebruiker
   überhaupt van toepassing is.
2. Haal ook `rekeningschema` op, zodat je weet welke rekeningen er zijn.
3. Download voor elk onverwerkt document het bestand via de Supabase
   Storage API (met de `SUPABASE_SERVICE_ROLE_KEY`-omgevingsvariabele,
   nooit de sleutel zelf tonen/printen) en bekijk het.
4. Voor tekstrijke, meerpagina PDF-facturen (geen gefotografeerd bonnetje):
   gebruik eerst `markitdown` om het document naar platte tekst om te
   zetten (`pip install 'markitdown[pdf]'`, dan `markitdown bestand.pdf`) —
   scheelt tokens. Voor gefotografeerde bonnetjes en simpele PDF's: gewoon
   direct met de Read-tool lezen, dat is vaak nauwkeuriger.
5. Bepaal per document: datum, partij (leverancier/klant), omschrijving,
   passende rekeningcode, bedrag (incl. of excl. BTW), BTW%, factuurnummer
   indien aanwezig, én de **tegenrekening**:
   - `heeft_zakelijke_rekening = false`: tegenrekening is **altijd**
     "Privé". Geen heuristiek nodig — deze gebruiker heeft geen zakelijke
     rekening, dus elke uitgave/inkomst loopt via privé.
   - `heeft_zakelijke_rekening = true`: standaard "Privé", en alleen
     "Bank" als overduidelijk is dat de zakelijke rekening erbij betrokken
     is.
   **Schat nooit een ontbrekend veld.** Staat een veld niet duidelijk
   leesbaar op het document? Laat het dan leeg/weg. Alleen het bedrag is
   hierop een uitzondering: is dat niet leesbaar, sla het document dan
   over en vermeld dit apart aan het eind.
6. Duplicaatcheck: vergelijk de `hash` van het document met al eerder
   verwerkte documenten/boekingen. Kom je een match tegen, sla dat
   document dan over en meld dit apart.
7. Staan er meerdere bonnetjes/facturen op één document? Boek elk
   bonnetje als een eigen regel in `boekingen`, gekoppeld via
   `brondocument_id` aan hetzelfde document.
8. Voeg voor elk (niet-duplicaat) document een rij toe aan `boekingen`
   met dezelfde `gebruiker_id`/`user_id` als het document.
9. Zet de status van het document op `verwerkt` en vul `verwerkt_op` in.
10. Sluit af met een overzicht: hoeveel documenten verwerkt, welke velden
    per boeking leeg zijn gelaten, eventuele overgeslagen duplicaten, en
    documenten overgeslagen wegens onleesbaar bedrag.

## Protocol: facturen uit e-mail ophalen

Draait de gebruiker in een Cowork-sessie met de Gmail-connector gekoppeld
(joris.shedfinds@gmail.com), bv. wekelijks of per kwartaal.

1. Zoek in de mailbox naar facturen/bonnen over de gevraagde periode
   (bijlagen met "factuur"/"invoice"/"receipt", bekende afzenders van
   eerdere boekingen, PDF-bijlagen).
2. Download elke gevonden factuur, bereken de `hash` en sla duplicaten
   over (check tegen bestaande `documents`).
3. Upload het bestand naar de documents-storagebucket en voeg een
   `documents`-rij toe met `bron = 'email'` en
   `doc_status = 'nog_te_verwerken'`.
4. Verwerk daarna via het gewone bonnetjes-protocol hierboven.
5. Sluit af met een lijst: gevonden facturen, overgeslagen duplicaten,
   en twijfelgevallen (mails die op een factuur lijken maar het mogelijk
   niet zijn — niet zelf beslissen, voorleggen).

## Protocol: kwartaal-bankafstemming

**Alleen van toepassing als `profielen.heeft_zakelijke_rekening = true`.**
Staat die uit, sla dit hele protocol over — er zijn geen bankafschriften
en elke boeking heeft toch al tegenrekening "Privé" gekregen.

Na afloop van een kwartaal levert de gebruiker de transacties van de
zakelijke rekening via het scherm "Bankafstemming" aan, op een van twee
manieren:

- **CSV** (de meeste banken): de app parset dit zelf en zet de regels
  direct in `bank_transacties` met `match_status = 'nog_te_matchen'`.
- **PDF-afschrift** (bv. Rabobank, die geen CSV-export aanbiedt voor
  zakelijke rekeningen): de app slaat alleen het bestand op als een
  `documents`-rij met `bron = 'bankexport'`, `doc_status =
  'nog_te_verwerken'` en de gekozen `periode`. Het omzetten naar
  `bank_transacties`-rijen gebeurt hier, stap 0.

0. Haal `documents` op met `bron = 'bankexport'` en `doc_status =
   'nog_te_verwerken'`. Bekijk elk PDF-afschrift (voor meerpagina-
   afschriften: eerst `markitdown`, net als bij tekstrijke facturen) en
   zet elke transactieregel om naar een `bank_transacties`-rij: datum,
   bedrag (bij = positief, af = negatief), omschrijving, tegenpartijnaam
   en -IBAN indien vermeld, `periode` uit de documentrij,
   `match_status = 'nog_te_matchen'`. Bereken `import_hash` (datum+bedrag+
   omschrijving+IBAN) en sla een regel over als diezelfde hash al bestaat
   (voorkomt dubbele import bij per ongeluk twee keer uploaden). Staat een
   bedrag niet duidelijk leesbaar, sla die regel dan over en meld dit apart
   — nooit gokken. Zet na verwerking de documentrij op `doc_status =
   'verwerkt'`.
1. Haal alle `bank_transacties` met `match_status = 'nog_te_matchen'`
   voor de periode op, plus de `boekingen` van (ruwweg) die periode.
2. Match per transactie op bedrag (= `bedrag_incl_btw`), datum in de
   buurt (boekingsdatum t/m ~30 dagen vóór afschrijving) en partijnaam.
   **Alleen koppelen bij een eenduidige match** — bij twijfel laten staan
   en melden. Nooit gokken.
3. Bij een match: zet `boeking_id`, `match_status = 'gematcht'`, en zet
   de `tegenrekening` van die boeking op 'Bank' (het geld liep immers
   aantoonbaar via de zakelijke rekening).
4. Zakelijke transacties zonder bijpassende boeking/factuur: laat
   `nog_te_matchen` staan en zet ze in het eindrapport, zodat de
   gebruiker de factuur kan opvragen of alsnog kan uploaden. Duidelijk
   privé-opnames/-stortingen mag je op `prive` zetten met toelichting.
5. Sluit af met een overzicht: aantal geïmporteerde PDF-transacties (indien
   van toepassing), aantal gematcht, transacties zonder factuur (met
   bedrag+tegenpartij), en twijfelgevallen.

## Datamodel (Supabase)

- `documents` — ruwe uploads: id, user_id, file_name, file_path,
  mime_type, amount, doc_status ('nog_te_verwerken'/'verwerkt'), hash,
  bron ('upload'/'email'/'bankexport'), periode (YYYY-Qn, alleen gezet bij
  bron = 'bankexport')
- `boekingen` — boekingsregels: id, gebruiker_id, datum, type
  (Inkoop/Verkoop/Overig), partij, omschrijving, factuurnummer,
  rekeningcode, tegenrekening, bedrag_excl_btw, btw_percentage,
  btw_bedrag, bedrag_incl_btw, brondocument_id, aangifte_periode,
  verwerkt_op
- `rekeningschema` — grootboekrekeningen: code, naam, categorie
  (Omzet/Kosten/BTW/Activa/Overig/Eigen vermogen), standaard_btw_percentage,
  actief
- `profielen` — naam, email, avatar_path, is_admin, heeft_zakelijke_rekening
  (bepaalt of Bankafstemming van toepassing is en of tegenrekening altijd
  Privé is; default false). Wordt automatisch aangemaakt door een trigger
  (`on_auth_user_created`) zodra iemand een account aanmaakt — hoeft niet
  te wachten tot iemand naar Instellingen gaat.
- `btw_kwartalen` — periode, status (open/ingediend), ingediend_bedrag,
  ingediend_op, brondocument_pad (voor eerder ingediende aangiftes)
- `bank_transacties` — geïmporteerde bankregels: id, gebruiker_id,
  boekdatum, bedrag (positief = bij), tegenpartij_naam, tegenpartij_iban,
  omschrijving, periode (YYYY-Qn), match_status
  ('nog_te_matchen'/'gematcht'/'geen_factuur'/'prive'), boeking_id,
  match_toelichting, import_hash

`tegenrekening` (Privé/Bank) maakt elke boeking een compleet dubbel-boekhoud-
kundig 2-benig journaalpost: rekeningcode + BTW-rekening (afgeleid) samen
zijn altijd gelijk aan de tegenrekening-kant. Balans, W&V en BTW-aangifte
gebruiken allemaal dezelfde saldo-per-rekening-berekening.

## Belangrijk

- Wijzig de database alleen via de Supabase MCP-tools, niet buitenom.
- Geheimen (service role key, access tokens) nooit in de chat plakken of
  laten printen/echoën — alleen als omgevingsvariabele lokaal instellen.
