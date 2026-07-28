'use client';

import { createClient } from '@/lib/supabase/client';

export type MatchStatus = 'nog_te_matchen' | 'gematcht' | 'geen_factuur' | 'prive';

export interface BankTransactie {
  id: string;
  gebruikerId: string;
  boekdatum: string;
  bedrag: number;
  tegenpartijNaam: string | null;
  tegenpartijIban: string | null;
  omschrijving: string | null;
  periode: string;
  matchStatus: MatchStatus;
  boekingId: string | null;
  matchToelichting: string | null;
  importHash: string;
  createdAt: string;
  // Joined boeking data (optional)
  boeking?: {
    partij: string | null;
    bedragInclBtw: number;
    datum: string | null;
  } | null;
}

export interface NieuweTransactie {
  boekdatum: string;
  bedrag: number;
  tegenpartijNaam?: string;
  tegenpartijIban?: string;
  omschrijving?: string;
  periode: string;
  importHash: string;
}

function mapRow(row: Record<string, unknown>): BankTransactie {
  return {
    id: row.id as string,
    gebruikerId: row.gebruiker_id as string,
    boekdatum: row.boekdatum as string,
    bedrag: Number(row.bedrag),
    tegenpartijNaam: (row.tegenpartij_naam as string) ?? null,
    tegenpartijIban: (row.tegenpartij_iban as string) ?? null,
    omschrijving: (row.omschrijving as string) ?? null,
    periode: row.periode as string,
    matchStatus: row.match_status as MatchStatus,
    boekingId: (row.boeking_id as string) ?? null,
    matchToelichting: (row.match_toelichting as string) ?? null,
    importHash: row.import_hash as string,
    createdAt: row.created_at as string,
    boeking: row.boekingen
      ? {
          partij: (row.boekingen as Record<string, unknown>).partij as string | null,
          bedragInclBtw: Number((row.boekingen as Record<string, unknown>).bedrag_incl_btw),
          datum: (row.boekingen as Record<string, unknown>).datum as string | null,
        }
      : null,
  };
}

export const bankTransactiesService = {
  /** Haal alle transacties op voor een kwartaal (YYYY-Qn) */
  async getTransacties(periode: string): Promise<BankTransactie[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bank_transacties')
      .select('*, boekingen(partij, bedrag_incl_btw, datum)')
      .eq('gebruiker_id', user.id)
      .eq('periode', periode)
      .order('boekdatum', { ascending: false });

    if (error) {
      console.error('getTransacties error:', error.message);
      return [];
    }
    return (data || []).map(mapRow);
  },

  /** Importeer een batch transacties; retourneert { ingevoegd, overgeslagen } */
  async importTransacties(
    transacties: NieuweTransactie[]
  ): Promise<{ ingevoegd: number; overgeslagen: number }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ingevoegd: 0, overgeslagen: transacties.length };

    let ingevoegd = 0;
    let overgeslagen = 0;

    // Batch upsert met ignore_duplicates via onConflict
    const rows = transacties.map((t) => ({
      gebruiker_id: user.id,
      boekdatum: t.boekdatum,
      bedrag: t.bedrag,
      tegenpartij_naam: t.tegenpartijNaam ?? null,
      tegenpartij_iban: t.tegenpartijIban ?? null,
      omschrijving: t.omschrijving ?? null,
      periode: t.periode,
      match_status: 'nog_te_matchen' as MatchStatus,
      import_hash: t.importHash,
    }));

    // Controleer eerst welke hashes al bestaan
    const hashes = rows.map((r) => r.import_hash);
    const { data: bestaand } = await supabase
      .from('bank_transacties')
      .select('import_hash')
      .eq('gebruiker_id', user.id)
      .in('import_hash', hashes);

    const bestaandeHashes = new Set((bestaand || []).map((r: Record<string, unknown>) => r.import_hash as string));
    const nieuweRijen = rows.filter((r) => !bestaandeHashes.has(r.import_hash));
    overgeslagen = rows.length - nieuweRijen.length;

    if (nieuweRijen.length > 0) {
      const { error } = await supabase.from('bank_transacties').insert(nieuweRijen);
      if (error) {
        console.error('importTransacties error:', error.message);
      } else {
        ingevoegd = nieuweRijen.length;
      }
    }

    return { ingevoegd, overgeslagen };
  },

  /** Koppel transactie aan een boeking */
  async koppelBoeking(transactieId: string, boekingId: string): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('bank_transacties')
      .update({ boeking_id: boekingId, match_status: 'gematcht' })
      .eq('id', transactieId)
      .eq('gebruiker_id', user.id);

    if (error) console.error('koppelBoeking error:', error.message);
    return !error;
  },

  /** Markeer als privé of geen_factuur */
  async markeerStatus(
    transactieId: string,
    status: 'prive' | 'geen_factuur',
    toelichting?: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('bank_transacties')
      .update({
        match_status: status,
        match_toelichting: toelichting ?? null,
        boeking_id: null,
      })
      .eq('id', transactieId)
      .eq('gebruiker_id', user.id);

    if (error) console.error('markeerStatus error:', error.message);
    return !error;
  },

  /** Ontkoppel transactie (terug naar nog_te_matchen) */
  async ontkoppel(transactieId: string): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('bank_transacties')
      .update({
        match_status: 'nog_te_matchen',
        boeking_id: null,
        match_toelichting: null,
      })
      .eq('id', transactieId)
      .eq('gebruiker_id', user.id);

    if (error) console.error('ontkoppel error:', error.message);
    return !error;
  },

  /** Haal beschikbare periodes op voor de huidige gebruiker */
  async getPeriodes(): Promise<string[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bank_transacties')
      .select('periode')
      .eq('gebruiker_id', user.id)
      .order('periode', { ascending: false });

    if (error) return [];
    const uniek = [...new Set((data || []).map((r: Record<string, unknown>) => r.periode as string))];
    return uniek;
  },

  /** Upload een PDF-rekeningafschrift. Geen parsing hier — wordt in een
   *  Cowork-sessie omgezet naar bank_transacties (zie CLAUDE.md). */
  async uploadPdfAfschrift(file: File, periode: string): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitized}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadErr) {
      console.error('uploadPdfAfschrift storage error:', uploadErr.message);
      return false;
    }

    const { error: insertErr } = await supabase.from('documents').insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: 'application/pdf',
      bucket_name: 'documents',
      doc_status: 'nog_te_verwerken',
      bron: 'bankexport',
      periode,
    });
    if (insertErr) {
      console.error('uploadPdfAfschrift insert error:', insertErr.message);
      return false;
    }
    return true;
  },

  /** Is er voor dit kwartaal nog een PDF-afschrift dat op verwerking wacht? */
  async getWachtendAfschrift(periode: string): Promise<{ fileName: string; createdAt: string } | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('documents')
      .select('file_name, created_at')
      .eq('user_id', user.id)
      .eq('bron', 'bankexport')
      .eq('doc_status', 'nog_te_verwerken')
      .eq('periode', periode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return { fileName: data.file_name as string, createdAt: data.created_at as string };
  },
};
