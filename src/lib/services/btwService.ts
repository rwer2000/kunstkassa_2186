import { createClient } from '@/lib/supabase/client';
import { calcBtwSaldo } from './boekingenService';

export interface BtwKwartaal {
  id: string;
  gebruikerId: string;
  periode: string; // e.g. "2026-Q1"
  status: 'open' | 'ingediend';
  ingediendBedrag: number | null;
  ingediendOp: string | null;
  brondocumentPad: string | null;
  createdAt: string;
}

export interface BoekingenVoorPeriode {
  id: string;
  datum: string | null;
  partij: string | null;
  omschrijving: string | null;
  bedragExclBtw: number;
  btwBedrag: number | null;
  bedragInclBtw: number;
  type: 'Inkoop' | 'Verkoop' | 'Overig';
  aangifte_periode: string | null;
}

export interface OpenstaandSaldo {
  boekingen: BoekingenVoorPeriode[];
  berekendSaldo: number; // Verkoop BTW - Inkoop BTW, over alle nog niet ingediende boekingen
}

export interface KwartaalMetBoekingen {
  kwartaal: BtwKwartaal;
  boekingen: BoekingenVoorPeriode[];
}

/** Convert a date string to "YYYY-QN" format */
export function datumNaarKwartaal(datum: string): string {
  const d = new Date(datum);
  const year = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

/** Get current quarter as "YYYY-QN" */
export function huidigKwartaal(): string {
  return datumNaarKwartaal(new Date().toISOString());
}

export const btwService = {
  /** Fetch all btw_kwartalen for the current user */
  async getKwartalen(): Promise<BtwKwartaal[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('btw_kwartalen').select('*').eq('gebruiker_id', user.id).order('periode', { ascending: false });

    if (error) {
      console.error('getKwartalen error:', error.message);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      gebruikerId: r.gebruiker_id,
      periode: r.periode,
      status: r.status,
      ingediendBedrag: r.ingediend_bedrag ?? null,
      ingediendOp: r.ingediend_op ?? null,
      brondocumentPad: r.brondocument_pad ?? null,
      createdAt: r.created_at,
    }));
  },

  /** Fetch all boekingen with aangifte_periode for the current user */
  async getBoekingenMetPeriode(): Promise<BoekingenVoorPeriode[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('boekingen').select('id, datum, partij, omschrijving, bedrag_excl_btw, btw_bedrag, bedrag_incl_btw, type, aangifte_periode').eq('gebruiker_id', user.id).order('datum', { ascending: false });

    if (error) {
      console.error('getBoekingenMetPeriode error:', error.message);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      datum: r.datum,
      partij: r.partij,
      omschrijving: r.omschrijving,
      bedragExclBtw: Number(r.bedrag_excl_btw ?? 0),
      btwBedrag: r.btw_bedrag != null ? Number(r.btw_bedrag) : null,
      bedragInclBtw: Number(r.bedrag_incl_btw ?? 0),
      type: r.type,
      aangifte_periode: r.aangifte_periode,
    }));
  },

  /** Boekingen die nog bij geen enkele ingediende aangifte horen (aangifte_periode = NULL).
   *  Dit is het doorlopende BTW-saldo: alles wat je nu zou kunnen terugvragen,
   *  ongeacht de factuurdatum. Een laat toegevoegde Q1-factuur telt hier gewoon
   *  in mee totdat je 'm indient — ook als dat pas in Q2 gebeurt. */
  async getOpenstaandeBoekingen(): Promise<BoekingenVoorPeriode[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('boekingen')
      .select('id, datum, partij, omschrijving, bedrag_excl_btw, btw_bedrag, bedrag_incl_btw, type, aangifte_periode')
      .eq('gebruiker_id', user.id)
      .is('aangifte_periode', null)
      .order('datum', { ascending: false });

    if (error) {
      console.error('getOpenstaandeBoekingen error:', error.message);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      datum: r.datum,
      partij: r.partij,
      omschrijving: r.omschrijving,
      bedragExclBtw: Number(r.bedrag_excl_btw ?? 0),
      btwBedrag: r.btw_bedrag != null ? Number(r.btw_bedrag) : null,
      bedragInclBtw: Number(r.bedrag_incl_btw ?? 0),
      type: r.type,
      aangifte_periode: r.aangifte_periode,
    }));
  },

  /** Bereken het doorlopende BTW-saldo (Verkoop BTW − Inkoop BTW) */
  berekenOpenstaandSaldo(boekingen: BoekingenVoorPeriode[]): OpenstaandSaldo {
    return { boekingen, berekendSaldo: calcBtwSaldo(boekingen) };
  },

  /** Koppel elk ingediend kwartaal aan de boekingen die er destijds mee zijn
   *  meegestempeld, voor het historische overzicht. */
  buildKwartalenMetBoekingen(
    kwartalen: BtwKwartaal[],
    boekingen: BoekingenVoorPeriode[]
  ): KwartaalMetBoekingen[] {
    return kwartalen
      .slice()
      .sort((a, b) => b.periode.localeCompare(a.periode))
      .map((kwartaal) => ({
        kwartaal,
        boekingen: boekingen.filter((b) => b.aangifte_periode === kwartaal.periode),
      }));
  },

  /** Submit a quarter: set status to 'ingediend' (upsert only, raakt geen boekingen aan —
   *  gebruikt door dienOpenstaandSaldoIn hieronder én door historischKwartaalToevoegen) */
  async kwartaalIndienen(
    periode: string,
    ingediendBedrag: number,
    brondocumentPad?: string
  ): Promise<BtwKwartaal | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('btw_kwartalen')
      .upsert(
        {
          gebruiker_id: user.id,
          periode,
          status: 'ingediend',
          ingediend_bedrag: ingediendBedrag,
          ingediend_op: now,
          brondocument_pad: brondocumentPad ?? null,
          updated_at: now,
        },
        { onConflict: 'gebruiker_id,periode' }
      )
      .select()
      .single();

    if (error) {
      console.error('kwartaalIndienen error:', error.message);
      throw new Error(error.message);
    }

    return {
      id: data.id,
      gebruikerId: data.gebruiker_id,
      periode: data.periode,
      status: data.status,
      ingediendBedrag: data.ingediend_bedrag ?? null,
      ingediendOp: data.ingediend_op ?? null,
      brondocumentPad: data.brondocument_pad ?? null,
      createdAt: data.created_at,
    };
  },

  /** Dien het huidige openstaande BTW-saldo in als aangifte voor `periode`.
   *  Stempelt alle nog niet toegewezen boekingen (aangifte_periode = NULL)
   *  met deze periode, zodat ze vanaf nu bij deze (afgeronde) aangifte horen
   *  en het openstaande saldo weer bij nul begint. */
  async dienOpenstaandSaldoIn(
    periode: string,
    ingediendBedrag: number,
    brondocumentPad?: string
  ): Promise<BtwKwartaal | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    const { error: stampError } = await supabase
      .from('boekingen')
      .update({ aangifte_periode: periode })
      .eq('gebruiker_id', user.id)
      .is('aangifte_periode', null);

    if (stampError) {
      console.error('dienOpenstaandSaldoIn stamp error:', stampError.message);
      throw new Error(stampError.message);
    }

    return btwService.kwartaalIndienen(periode, ingediendBedrag, brondocumentPad);
  },

  /** Manually add a historical quarter (with optional PDF upload) */
  async historischKwartaalToevoegen(
    periode: string,
    ingediendBedrag: number,
    pdfFile?: File
  ): Promise<BtwKwartaal | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    let brondocumentPad: string | null = null;

    if (pdfFile) {
      const timestamp = Date.now();
      const sanitized = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from('btw-aangiften')
        .upload(filePath, pdfFile, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('PDF upload error:', uploadError.message);
        throw new Error(uploadError.message);
      }
      brondocumentPad = filePath;
    }

    return btwService.kwartaalIndienen(periode, ingediendBedrag, brondocumentPad ?? undefined);
  },

  /** Get a signed URL for a stored BTW PDF */
  async getSignedUrl(filePath: string): Promise<string | null> {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('btw-aangiften')
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl ?? null;
  },
};
