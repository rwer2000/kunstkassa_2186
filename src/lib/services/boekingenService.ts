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
  bedragExclBtw: number;
  btwPercentage?: number;
  btwBedrag?: number;
  bedragInclBtw: number;
  brondocumentId?: string;
}

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
