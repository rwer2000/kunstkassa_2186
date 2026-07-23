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

export interface PeriodeSamenvatting {
  periode: string;
  kwartaal: BtwKwartaal | null;
  boekingen: BoekingenVoorPeriode[];
  berekendSaldo: number; // Verkoop BTW - Inkoop BTW
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
  /** Determine the aangifte_periode for a new boeking given its datum */
  async bepaalAangiftePeriode(datum: string, gebruikerId: string): Promise<string> {
    const supabase = createClient();
    const kwartaalVanDatum = datumNaarKwartaal(datum);

    // Check if this quarter is already 'ingediend' for this user
    const { data: kwartaalRow } = await supabase
      .from('btw_kwartalen')
      .select('status')
      .eq('gebruiker_id', gebruikerId)
      .eq('periode', kwartaalVanDatum)
      .maybeSingle();

    if (!kwartaalRow || kwartaalRow.status !== 'ingediend') {
      // Not yet submitted — use the quarter of the datum
      return kwartaalVanDatum;
    }

    // Quarter is already submitted — find the current open quarter
    const huidig = huidigKwartaal();

    // Check if there's already an open row for the current quarter
    const { data: huidigRow } = await supabase
      .from('btw_kwartalen').select('status, periode').eq('gebruiker_id', gebruikerId).eq('periode', huidig)
      .maybeSingle();

    if (huidigRow && huidigRow.status === 'open') {
      return huidig;
    }

    // Find the most recent open period
    const { data: openRows } = await supabase
      .from('btw_kwartalen').select('periode').eq('gebruiker_id', gebruikerId).eq('status', 'open').order('periode', { ascending: false })
      .limit(1);

    if (openRows && openRows.length > 0) {
      return openRows[0].periode;
    }

    // Default to current quarter
    return huidig;
  },

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

  /** Build period summaries combining kwartalen + boekingen */
  buildPeriodeSamenvattingen(
    kwartalen: BtwKwartaal[],
    boekingen: BoekingenVoorPeriode[]
  ): PeriodeSamenvatting[] {
    // Collect all unique periods from both sources
    const periodeSet = new Set<string>();
    kwartalen.forEach((k) => periodeSet.add(k.periode));
    boekingen.forEach((b) => {
      if (b.aangifte_periode) periodeSet.add(b.aangifte_periode);
    });

    // Also add current quarter if not present
    periodeSet.add(huidigKwartaal());

    const kwartaalMap = new Map(kwartalen.map((k) => [k.periode, k]));

    const samenvattingen: PeriodeSamenvatting[] = Array.from(periodeSet)
      .sort((a, b) => b.localeCompare(a)) // descending
      .map((periode) => {
        const kwartaal = kwartaalMap.get(periode) ?? null;
        const periodBoekingen = boekingen.filter((b) => b.aangifte_periode === periode);

        // Use the central calcBtwSaldo function from boekingenService
        const berekendSaldo = calcBtwSaldo(periodBoekingen);

        return {
          periode,
          kwartaal,
          boekingen: periodBoekingen,
          berekendSaldo,
        };
      });

    return samenvattingen;
  },

  /** Submit a quarter: set status to 'ingediend' */
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
