'use client';

import { createClient } from '@/lib/supabase/client';
import { btwService } from './btwService';

export interface Boeking {
  id: string;
  gebruikerId: string;
  datum: string | null;
  type: 'Inkoop' | 'Verkoop' | 'Overig';
  partij: string | null;
  omschrijving: string | null;
  factuurnummer: string | null;
  rekeningcode: string | null;
  tegenrekening: string | null;
  bedragExclBtw: number;
  btwPercentage: number | null;
  btwBedrag: number | null;
  bedragInclBtw: number;
  brondocumentId: string | null;
  verwerktOp: string;
  aangifte_periode: string | null;
}

export interface NieuweBoeking {
  datum: string;
  type: 'Inkoop' | 'Verkoop' | 'Overig';
  partij?: string;
  omschrijving?: string;
  factuurnummer?: string;
  rekeningcode?: string;
  tegenrekening?: string;
  bedragExclBtw: number;
  btwPercentage?: number;
  btwBedrag?: number;
  bedragInclBtw: number;
  brondocumentId?: string;
}

// ─── Central saldo-per-rekening function ─────────────────────────────────────

export interface SaldoOptions {
  /** Start date inclusive (YYYY-MM-DD) */
  vanDatum: string;
  /** End date inclusive (YYYY-MM-DD) */
  totDatum: string;
  /** The rekeningschema.code to calculate the balance for */
  rekeningcode: string;
  /** The categorie of this rekening (used to determine sign) */
  categorie: string;
}

export interface SaldoResultaat {
  rekeningcode: string;
  saldo: number;
}

/**
 * Central function: calculate the balance for a single rekening over a period.
 *
 * Three contribution sources:
 * 1. Boekingen where this rekening is the `rekeningcode`:
 *    - Omzet: +bedrag_excl_btw
 *    - Kosten / Overig: +bedrag_excl_btw (cost side)
 *    - BTW rekeningen (1500 Verkoop-BTW, 1510 Inkoop-BTW): +btw_bedrag
 *    - Activa / Eigen vermogen: +bedrag_incl_btw
 * 2. Boekingen where this rekening is the BTW-rekening
 *    (1500 for Verkoop, 1510 for Inkoop/Overig): +btw_bedrag
 * 3. Boekingen where this rekening is the `tegenrekening`: -bedrag_incl_btw
 *    (opposite direction of the rekeningcode side)
 */
export async function saldoPerRekening(opts: SaldoOptions): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { vanDatum, totDatum, rekeningcode, categorie } = opts;

  // Fetch all boekingen in the period for this user
  const { data: boekingen, error } = await supabase
    .from('boekingen')
    .select('rekeningcode, tegenrekening, type, bedrag_excl_btw, btw_bedrag, bedrag_incl_btw')
    .eq('gebruiker_id', user.id)
    .gte('datum', vanDatum)
    .lte('datum', totDatum);

  if (error || !boekingen) return 0;

  let saldo = 0;

  // BTW-rekening codes
  const BTW_VERKOOP = '1500';
  const BTW_INKOOP = '1510';

  for (const b of boekingen) {
    const bedragExcl = Number(b.bedrag_excl_btw ?? 0);
    const btwBedrag = Number(b.btw_bedrag ?? 0);
    const bedragIncl = Number(b.bedrag_incl_btw ?? 0);

    // Source 1: this rekening is the rekeningcode
    if (b.rekeningcode === rekeningcode) {
      if (categorie === 'Omzet') {
        saldo += bedragExcl;
      } else if (categorie === 'Kosten' || categorie === 'Overig') {
        saldo += bedragExcl;
      } else if (categorie === 'BTW') {
        // BTW rekeningen (1500/1510) are NOT credited via rekeningcode on a boeking;
        // they receive their balance from Source 2 below.
        // Skip here to avoid double-counting.
      } else {
        // Activa, Eigen vermogen, etc.
        // For Activa/Eigen vermogen the tegenrekening side posts bedrag_incl_btw,
        // but the rekeningcode side posts only bedrag_excl_btw (BTW goes to BTW rekeningen).
        saldo += bedragExcl;
      }
    }

    // Source 2: BTW component — posts to Te betalen BTW (1500) or Te vorderen BTW (1510)
    // Te betalen BTW (1500): Verkoop boekingen — BTW collected from customers (liability)
    // Te vorderen BTW (1510): Inkoop/Overig boekingen — BTW paid to suppliers (asset/receivable)
    if (categorie === 'BTW') {
      const isBtwVerkoop = rekeningcode === BTW_VERKOOP && b.type === 'Verkoop';
      const isBtwInkoop = rekeningcode === BTW_INKOOP && (b.type === 'Inkoop' || b.type === 'Overig');
      if (isBtwVerkoop || isBtwInkoop) {
        saldo += btwBedrag;
      }
    }

    // Source 3: this rekening is the tegenrekening — opposite direction
    // The tegenrekening (e.g. Privé/Bank) receives bedrag_incl_btw in opposite direction.
    // Since BTW now posts to dedicated BTW rekeningen, the tegenrekening only receives
    // the full incl-BTW amount as the balancing entry.
    if (b.tegenrekening === rekeningcode) {
      saldo -= bedragIncl;
    }
  }

  return saldo;
}

// ─── BTW saldo helpers (used by btwService refactor) ─────────────────────────

/**
 * Calculate BTW saldo for a set of boekingen (already filtered by aangifte_periode).
 * Verkoop BTW - Inkoop BTW.
 * This keeps the existing BTW-aangifte behaviour unchanged.
 */
export function calcBtwSaldo(
  boekingen: Array<{ type: string; btwBedrag: number | null }>
): number {
  let verkoopBtw = 0;
  let inkoopBtw = 0;
  for (const b of boekingen) {
    const btw = b.btwBedrag ?? 0;
    if (b.type === 'Verkoop') verkoopBtw += btw;
    else if (b.type === 'Inkoop' || b.type === 'Overig') inkoopBtw += btw;
  }
  return verkoopBtw - inkoopBtw;
}

// ─── W&V saldo helpers ────────────────────────────────────────────────────────

export interface WenvRekeningRegel {
  code: string;
  naam: string;
  totaal: number;
}

/**
 * Calculate W&V totals per rekening for a given period.
 * Uses the same logic as the existing WenvContent query but as a reusable function.
 * Returns omzetRegels and kostenRegels (Kosten + Overig combined).
 */
export async function calcWenvRegels(
  vanDatum: string,
  totDatum: string
): Promise<{ omzetRegels: WenvRekeningRegel[]; kostenRegels: WenvRekeningRegel[] }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { omzetRegels: [], kostenRegels: [] };

  const [boekingenRes, rekeningenRes] = await Promise.all([
    supabase
      .from('boekingen')
      .select('rekeningcode, bedrag_excl_btw')
      .eq('gebruiker_id', user.id)
      .gte('datum', vanDatum)
      .lte('datum', totDatum),
    supabase
      .from('rekeningschema')
      .select('code, naam, categorie')
      .in('categorie', ['Omzet', 'Kosten', 'Overig']),
  ]);

  if (boekingenRes.error || rekeningenRes.error) {
    return { omzetRegels: [], kostenRegels: [] };
  }

  const boekingen = boekingenRes.data || [];
  const rekeningen = rekeningenRes.data || [];

  const rekeningMap = new Map<string, { naam: string; categorie: string }>();
  for (const r of rekeningen) {
    rekeningMap.set(r.code, { naam: r.naam, categorie: r.categorie });
  }

  const totaalPerCode = new Map<string, number>();
  for (const b of boekingen) {
    if (!b.rekeningcode) continue;
    const rekening = rekeningMap.get(b.rekeningcode);
    if (!rekening) continue;
    const huidig = totaalPerCode.get(b.rekeningcode) ?? 0;
    totaalPerCode.set(b.rekeningcode, huidig + Number(b.bedrag_excl_btw ?? 0));
  }

  const omzetRegels: WenvRekeningRegel[] = [];
  const kostenRegels: WenvRekeningRegel[] = [];

  for (const [code, totaal] of totaalPerCode.entries()) {
    const rekening = rekeningMap.get(code)!;
    const regel: WenvRekeningRegel = { code, naam: rekening.naam, totaal };
    if (rekening.categorie === 'Omzet') {
      omzetRegels.push(regel);
    } else {
      kostenRegels.push(regel);
    }
  }

  omzetRegels.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  kostenRegels.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  return { omzetRegels, kostenRegels };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const boekingenService = {
  async getBoekingen(): Promise<Boeking[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('boekingen')
      .select('*')
      .eq('gebruiker_id', user.id)
      .order('datum', { ascending: false });

    if (error) {
      console.error('getBoekingen error:', error.message);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      gebruikerId: r.gebruiker_id,
      datum: r.datum,
      type: r.type,
      partij: r.partij,
      omschrijving: r.omschrijving,
      factuurnummer: r.factuurnummer,
      rekeningcode: r.rekeningcode,
      tegenrekening: r.tegenrekening ?? null,
      bedragExclBtw: Number(r.bedrag_excl_btw ?? 0),
      btwPercentage: r.btw_percentage != null ? Number(r.btw_percentage) : null,
      btwBedrag: r.btw_bedrag != null ? Number(r.btw_bedrag) : null,
      bedragInclBtw: Number(r.bedrag_incl_btw ?? 0),
      brondocumentId: r.brondocument_id ?? null,
      verwerktOp: r.verwerkt_op,
      aangifte_periode: r.aangifte_periode ?? null,
    }));
  },

  async createBoeking(nieuw: NieuweBoeking): Promise<Boeking | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Niet ingelogd');

    const aangifte_periode = await btwService.bepaalAangiftePeriode(nieuw.datum, user.id);

    // Default tegenrekening to Privé (3000) if not explicitly provided
    const tegenrekening = nieuw.tegenrekening ?? '3000';

    const { data, error } = await supabase
      .from('boekingen')
      .insert({
        gebruiker_id: user.id,
        datum: nieuw.datum,
        type: nieuw.type,
        partij: nieuw.partij ?? null,
        omschrijving: nieuw.omschrijving ?? null,
        factuurnummer: nieuw.factuurnummer ?? null,
        rekeningcode: nieuw.rekeningcode ?? null,
        tegenrekening,
        bedrag_excl_btw: nieuw.bedragExclBtw,
        btw_percentage: nieuw.btwPercentage ?? null,
        btw_bedrag: nieuw.btwBedrag ?? null,
        bedrag_incl_btw: nieuw.bedragInclBtw,
        brondocument_id: nieuw.brondocumentId ?? null,
        aangifte_periode,
      })
      .select()
      .single();

    if (error) {
      console.error('createBoeking error:', error.message);
      throw new Error(error.message);
    }

    // Mark the source document as 'verwerkt' if linked
    if (nieuw.brondocumentId) {
      await supabase
        .from('documents')
        .update({ doc_status: 'verwerkt', amount: nieuw.bedragInclBtw })
        .eq('id', nieuw.brondocumentId)
        .eq('user_id', user.id);
    }

    return {
      id: data.id,
      gebruikerId: data.gebruiker_id,
      datum: data.datum,
      type: data.type,
      partij: data.partij,
      omschrijving: data.omschrijving,
      factuurnummer: data.factuurnummer,
      rekeningcode: data.rekeningcode,
      tegenrekening: data.tegenrekening ?? null,
      bedragExclBtw: Number(data.bedrag_excl_btw ?? 0),
      btwPercentage: data.btw_percentage != null ? Number(data.btw_percentage) : null,
      btwBedrag: data.btw_bedrag != null ? Number(data.btw_bedrag) : null,
      bedragInclBtw: Number(data.bedrag_incl_btw ?? 0),
      brondocumentId: data.brondocument_id ?? null,
      verwerktOp: data.verwerkt_op,
      aangifte_periode: data.aangifte_periode ?? null,
    };
  },

  /** Calculate monthly totals from boekingen */
  calcMaandTotalen(boekingen: Boeking[]): { thisMonthTotal: number; prevMonthTotal: number } {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const prevDate = new Date(thisYear, thisMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    let thisMonthTotal = 0;
    let prevMonthTotal = 0;

    for (const b of boekingen) {
      if (!b.datum) continue;
      const d = new Date(b.datum);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (y === thisYear && m === thisMonth) thisMonthTotal += b.bedragInclBtw;
      else if (y === prevYear && m === prevMonth) prevMonthTotal += b.bedragInclBtw;
    }

    return { thisMonthTotal, prevMonthTotal };
  },
};
