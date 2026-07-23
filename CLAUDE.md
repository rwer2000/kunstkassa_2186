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

1. Haal via de Supabase MCP alle rijen op uit `documents` met
   `doc_status = 'nog_te_verwerken'`.
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
   - Standaard "Privé" (de meeste ZZP'ers hebben geen zakelijke rekening,
     dus geld gaat rechtstreeks van/naar privé)
   - "Bank" alleen als overduidelijk is dat er een zakelijke rekening bij
     betrokken is
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

## Datamodel (Supabase)

- `documents` — ruwe uploads: id, user_id, file_name, file_path,
  mime_type, amount, doc_status ('nog_te_verwerken'/'verwerkt'), hash
- `boekingen` — boekingsregels: id, gebruiker_id, datum, type
  (Inkoop/Verkoop/Overig), partij, omschrijving, factuurnummer,
  rekeningcode, tegenrekening, bedrag_excl_btw, btw_percentage,
  btw_bedrag, bedrag_incl_btw, brondocument_id, aangifte_periode,
  verwerkt_op
- `rekeningschema` — grootboekrekeningen: code, naam, categorie
  (Omzet/Kosten/BTW/Activa/Overig/Eigen vermogen), standaard_btw_percentage,
  actief
- `profielen` — naam, email, avatar_path, is_admin
- `btw_kwartalen` — periode, status (open/ingediend), ingediend_bedrag,
  ingediend_op, brondocument_pad (voor eerder ingediende aangiftes)

`tegenrekening` (Privé/Bank) maakt elke boeking een compleet dubbel-boekhoud-
kundig 2-benig journaalpost: rekeningcode + BTW-rekening (afgeleid) samen
zijn altijd gelijk aan de tegenrekening-kant. Balans, W&V en BTW-aangifte
gebruiken allemaal dezelfde saldo-per-rekening-berekening.

## Belangrijk

- Wijzig de database alleen via de Supabase MCP-tools, niet buitenom.
- Geheimen (service role key, access tokens) nooit in de chat plakken of
  laten printen/echoën — alleen als omgevingsvariabele lokaal instellen.
