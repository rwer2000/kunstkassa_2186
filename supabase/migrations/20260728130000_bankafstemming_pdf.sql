-- Migration: PDF-rekeningafschriften voor Bankafstemming
-- Timestamp: 20260728130000
--
-- Rabobank zakelijke rekeningen kunnen alleen PDF-afschriften downloaden,
-- geen CSV. Voor die route slaat de app het bestand alleen op als
-- documents-rij (bron = 'bankexport', doc_status = 'nog_te_verwerken');
-- het omzetten naar bank_transacties-rijen gebeurt in een Cowork-sessie
-- (zie CLAUDE.md, protocol kwartaal-bankafstemming).
--
-- Deze kolom slaat op welk kwartaal het afschrift betreft, zodat de app
-- kan tonen dat er nog een afschrift op verwerking wacht.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS periode text;

CREATE INDEX IF NOT EXISTS idx_documents_bron_periode_status
  ON public.documents(bron, periode, doc_status);
