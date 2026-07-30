# Rocket-prompt: Bankafstemming

Kopieer onderstaande prompt naar Rocket.

---

Bouw een nieuwe feature "Bankafstemming" in deze bestaande Next.js + Supabase boekhoud-app (KunstKassa). Volg de bestaande conventies: Nederlandse labels, Tailwind, mobile-first, bestaande AppLayout/AppHeader/BottomNav, StatusBadge-component, RLS-patroon van de bestaande tabellen (gebruikers zien alleen eigen rijen). Periodes hebben overal het formaat `YYYY-Qn` (bv. `2026-Q2`), zoals in het BTW-aangiftescherm.

**Belangrijk: bouw GEEN automatische matching-logica en GEEN e-mailintegratie.** Het matchen van transacties aan boekingen gebeurt buiten de app om (een AI-sessie schrijft rechtstreeks naar de database). De app hoeft transacties alleen te importeren, tonen en handmatig aanpasbaar te maken.

## 1. Database (nieuwe Supabase-migratie)

Nieuwe tabel `bank_transacties`:

- `id` uuid PK, `gebruiker_id` uuid → auth.users
- `boekdatum` date
- `bedrag` numeric(10,2) — positief = bijschrijving, negatief = afschrijving
- `tegenpartij_naam` text, `tegenpartij_iban` text
- `omschrijving` text
- `periode` text — kwartaal `YYYY-Qn`
- `match_status` enum: `nog_te_matchen` (default), `gematcht`, `geen_factuur`, `prive`
- `boeking_id` uuid nullable → public.boekingen
- `match_toelichting` text nullable
- `import_hash` text — hash van datum+bedrag+omschrijving+iban, met unique index per gebruiker zodat dezelfde transactie niet twee keer geïmporteerd kan worden
- `created_at` timestamptz default now()

RLS aan, policies identiek aan het patroon van `boekingen`. Indexen op (gebruiker_id, periode) en match_status.

Daarnaast: voeg aan `documents` een kolom `bron` toe (text, default `'upload'`, waarden `'upload' | 'email' | 'bankexport'`).

## 2. Scherm "Bankafstemming" (route `/bankafstemming`)

Voeg toe aan de bestaande navigatie.

**a) CSV-import (stappenflow):**

1. Kwartaal kiezen (zelfde periode-opties als het BTW-scherm) + CSV-bestand kiezen.
2. Parse client-side met PapaParse. Toon een kolom-mappingstap: gebruiker wijst kolommen aan voor datum, bedrag, omschrijving, tegenpartij-naam, IBAN, en optioneel een aparte Af/Bij-kolom. Doe een slimme voorzet op basis van veelvoorkomende headers van NL-banken (ING, Rabobank, ABN AMRO, Knab, bunq). Ondersteun: datum als `dd-mm-jjjj` én `jjjjmmdd`, bedragen met komma als decimaalteken, en Af/Bij-kolom → negatief/positief bedrag.
3. Preview-tabel van de geparste transacties, met melding hoeveel er als duplicaat (import_hash) worden overgeslagen.
4. Opslaan: rijen naar `bank_transacties` met `match_status = 'nog_te_matchen'`; upload de ruwe CSV ook naar de documents-storagebucket en maak een `documents`-rij met `bron = 'bankexport'` en `doc_status = 'verwerkt'` (deze hoeft niet door de bonnetjesverwerking).

**b) Overzicht per kwartaal:**

- Kwartaalfilter bovenaan; samenvattingskaart: aantal gematcht / totaal, som van ongematchte bedragen.
- Tabel (mobile-first, op klein scherm kaartjes): datum, tegenpartij, omschrijving, bedrag, StatusBadge voor match_status, en bij `gematcht` de gekoppelde boeking (partij + bedrag, link/verwijzing).
- Filter op match_status.

**c) Handmatige acties per transactie:**

- Koppelen aan een bestaande boeking: zoekvenster over `boekingen` (partij, datum, bedrag), selectie zet `boeking_id` + `match_status = 'gematcht'`.
- Markeren als `prive` of `geen_factuur` (met optionele toelichting in `match_toelichting`).
- Ontkoppelen (terug naar `nog_te_matchen`).

## 3. Klein extra

Waar documenten getoond worden (bv. archief): toon een klein badge "via e-mail" als `documents.bron = 'email'`.
