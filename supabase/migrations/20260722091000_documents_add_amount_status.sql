-- Migration: Add amount and status columns to documents table

-- 1. Add status enum type
DROP TYPE IF EXISTS public.document_status CASCADE;
CREATE TYPE public.document_status AS ENUM ('verwerkt', 'nog_te_verwerken');

-- 2. Add columns to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS doc_status public.document_status DEFAULT 'nog_te_verwerken'::public.document_status;
