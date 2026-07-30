# Rocket-prompt: PDF-rekeningafschriften toevoegen aan Bankafstemming

Vervolg op de eerdere "Bankafstemming"-feature (tabellen `bank_transacties` en
`documents.bron` bestaan al). Rabobank zakelijke rekeningen kunnen alleen
PDF-afschriften downloaden, geen CSV. Voeg PDF als tweede importoptie toe.

**Belangrijk: bouw geen PDF-tabel-parsing in de app.** Tekst betrouwbaar uit
een bank-PDF trekken en in nette rijen zetten is te foutgevoelig om
client-side of in een API-route te doen. In plaats daarvan: de PDF wordt
gewoon opgeslagen, en een AI-sessie (buiten de app om) zet 'm later om in
`bank_transacties`-rijen — zelfde patroon als de bestaande bonnetjesverwerking.

## 1. Database

Migratie: voeg aan `documents` een kolom `periode` toe (text, nullable) —
het kwartaal (`YYYY-Qn`) waar het document bij hoort, alleen relevant voor
`bron = 'bankexport'`.

## 2. Uploadstap in "Bankafstemming" aanpassen

Bied bij het importeren een keuze: **CSV** (bestaande flow, ongewijzigd) of
**PDF-afschrift** (nieuw):

- Kwartaal kiezen (zelfde periode-opties als de rest van de app) + PDF-bestand
  kiezen.
- Geen preview/parsing — gewoon uploaden naar de documents-storagebucket en
  een `documents`-rij aanmaken met `bron = 'bankexport'`,
  `doc_status = 'nog_te_verwerken'`, en de gekozen `periode`.
- Bevestigingsmelding: "Afschrift geüpload. Wordt verwerkt bij de
  eerstvolgende Claude-sessie." Geen verdere actie nodig van de gebruiker.

## 3. Overzichtsscherm

- Toon boven de transactietabel een banner zolang er voor het gekozen
  kwartaal nog een `documents`-rij met `bron = 'bankexport'` en
  `doc_status = 'nog_te_verwerken'` bestaat: "Afschrift van [datum] wacht nog
  op verwerking." (query op periode + bron + doc_status, geen polling nodig).
- Verder ongewijzigd.

## 4. Overig

Sta bij de PDF-upload alleen `application/pdf` toe (net als andere
document-uploads in de app qua UI/validatie-stijl).
