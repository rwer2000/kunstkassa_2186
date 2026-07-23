'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { saldoPerRekening } from '@/lib/services/boekingenService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rekening {
  code: string;
  naam: string;
  categorie: string;
  actief: boolean;
}

interface VasteActivum {
  id: string;
  naam: string;
  rekeningcode: string;
  aanschafwaarde: number;
  aanschafdatum: string;
  afschrijvingsduur_jaren: number;
}

interface Beginbalans {
  rekeningcode: string;
  bedrag: number;
  datum: string;
}

interface BalansRegel {
  code: string;
  naam: string;
  categorie: string;
  saldo: number;
  boekwaarde?: number; // for vaste activa: aanschafwaarde - afschrijving
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}€\u00a0${formatted}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate linear depreciation for a vaste activum up to peildatum.
 * Returns the depreciation amount (never exceeds aanschafwaarde).
 */
function berekenAfschrijving(va: VasteActivum, peildatum: string): number {
  const aanschaf = new Date(va.aanschafdatum);
  const peil = new Date(peildatum);

  if (peil < aanschaf) return 0;

  // Number of months elapsed from aanschafdatum to peildatum (inclusive)
  const maanden =
    (peil.getFullYear() - aanschaf.getFullYear()) * 12 +
    (peil.getMonth() - aanschaf.getMonth());

  const totaleMaanden = va.afschrijvingsduur_jaren * 12;
  const ratio = Math.min(maanden / totaleMaanden, 1);
  return ratio * va.aanschafwaarde;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--primary)' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  );
}

// ─── Balans Section ───────────────────────────────────────────────────────────

interface BalansSectionProps {
  title: string;
  regels: BalansRegel[];
  totaal: number;
}

function BalansSection({ title, regels, totaal }: BalansSectionProps) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <span className="text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>{title}</span>
      </div>
      {regels.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Geen rekeningen met saldo.</p>
        </div>
      ) : regels.map((r, idx) => (
        <div
          key={r.code}
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: idx < regels.length - 1 ? '1px solid var(--border)' : undefined }}
        >
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-body-sm" style={{ color: 'var(--foreground)' }}>{r.naam}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {r.code}
              {r.boekwaarde !== undefined && (
                <span> · boekwaarde {formatEuro(r.boekwaarde)}</span>
              )}
            </p>
          </div>
          <span className="text-body-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
            {formatEuro(r.saldo)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
        <span className="text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>Totaal {title}</span>
        <span className="text-body-md font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{formatEuro(totaal)}</span>
      </div>
    </div>
  );
}

// ─── Main BalansContent ───────────────────────────────────────────────────────

export default function BalansContent() {
  const { user } = useAuth();
  const [peildatum, setPeildatum] = useState<string>(todayString);
  const [isLoading, setIsLoading] = useState(false);
  const [activaRegels, setActivaRegels] = useState<BalansRegel[]>([]);
  const [passivaRegels, setPassivaRegels] = useState<BalansRegel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const berekenBalans = useCallback(async () => {
    if (!user || !peildatum) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch all active rekeningen, vaste activa, and beginbalansen
      const [rekRes, vaRes, bbRes] = await Promise.all([
        supabase.from('rekeningschema').select('code, naam, categorie, actief').eq('actief', true),
        supabase.from('vaste_activa').select('*').eq('gebruiker_id', user.id),
        supabase.from('beginbalans').select('rekeningcode, bedrag, datum').eq('gebruiker_id', user.id),
      ]);

      if (rekRes.error) throw new Error(rekRes.error.message);

      const rekeningen: Rekening[] = rekRes.data || [];
      const vasteActivaList: VasteActivum[] = vaRes.data || [];
      const beginbalansen: Beginbalans[] = bbRes.data || [];

      // Build lookup maps
      const vaMap = new Map<string, VasteActivum[]>();
      for (const va of vasteActivaList) {
        const list = vaMap.get(va.rekeningcode) || [];
        list.push(va);
        vaMap.set(va.rekeningcode, list);
      }

      const bbMap = new Map<string, Beginbalans>();
      for (const bb of beginbalansen) {
        // Only use beginbalans if datum <= peildatum
        if (bb.datum <= peildatum) {
          bbMap.set(bb.rekeningcode, bb);
        }
      }

      // Categorise rekeningen for balans:
      // Activa: categorie 'Activa'
      // Passiva: categorie 'Eigen vermogen', 'Omzet', 'Kosten', 'Overig', 'BTW'
      // (BTW and Omzet/Kosten are included in passiva as they represent equity/liabilities)
      const ACTIVA_CATS = ['Activa'];
      const PASSIVA_CATS = ['Eigen vermogen', 'Omzet', 'Kosten', 'Overig', 'BTW'];

      const newActivaRegels: BalansRegel[] = [];
      const newPassivaRegels: BalansRegel[] = [];

      // Calculate saldo for each rekening
      for (const rek of rekeningen) {
        const cat = rek.categorie || '';
        const isActiva = ACTIVA_CATS.includes(cat);
        const isPassiva = PASSIVA_CATS.includes(cat);
        if (!isActiva && !isPassiva) continue;

        // 1. Beginbalans (if exists on/before peildatum)
        const bb = bbMap.get(rek.code);
        const beginSaldo = bb ? bb.bedrag : 0;

        // 2. Saldo from boekingen up to peildatum
        const boekSaldo = await saldoPerRekening({
          vanDatum: '2000-01-01', // all time up to peildatum
          totDatum: peildatum,
          rekeningcode: rek.code,
          categorie: cat,
        });

        let saldo = beginSaldo + boekSaldo;

        // 3. Vaste activa: subtract linear depreciation
        const vaList = vaMap.get(rek.code) || [];
        let totalAfschrijving = 0;
        let totalAanschafwaarde = 0;
        for (const va of vaList) {
          const afschr = berekenAfschrijving(va, peildatum);
          totalAfschrijving += afschr;
          totalAanschafwaarde += va.aanschafwaarde;
        }

        if (vaList.length > 0) {
          saldo -= totalAfschrijving;
        }

        // Only include rekeningen with non-zero saldo
        if (Math.abs(saldo) < 0.005) continue;

        const regel: BalansRegel = {
          code: rek.code,
          naam: rek.naam,
          categorie: cat,
          saldo,
        };

        if (vaList.length > 0) {
          regel.boekwaarde = totalAanschafwaarde - totalAfschrijving;
        }

        if (isActiva) {
          newActivaRegels.push(regel);
        } else {
          newPassivaRegels.push(regel);
        }
      }

      newActivaRegels.sort((a, b) => a.code.localeCompare(b.code));
      newPassivaRegels.sort((a, b) => a.code.localeCompare(b.code));

      setActivaRegels(newActivaRegels);
      setPassivaRegels(newPassivaRegels);
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden.');
    } finally {
      setIsLoading(false);
    }
  }, [user, peildatum]);

  useEffect(() => {
    berekenBalans();
  }, [berekenBalans]);

  const totaalActiva = activaRegels.reduce((sum, r) => sum + r.saldo, 0);
  const totaalPassiva = passivaRegels.reduce((sum, r) => sum + r.saldo, 0);
  const verschil = totaalActiva - totaalPassiva;
  const isBalanced = Math.abs(verschil) < 0.01;

  return (
    <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Balans</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>Vermogensoverzicht op peildatum</p>

      {/* Peildatum picker */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <label className="text-xs font-semibold mb-2 block uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
          Peildatum
        </label>
        <input
          type="date"
          value={peildatum}
          onChange={(e) => setPeildatum(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none"
          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm mb-4 px-4 py-3 rounded-xl" style={{ background: 'var(--error-bg, #fff0f0)', color: 'var(--error, #ba1a1a)', border: '1px solid var(--error-border, #ffd0d0)' }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <>
          {/* Activa column */}
          <BalansSection title="Activa" regels={activaRegels} totaal={totaalActiva} />

          {/* Passiva column */}
          <BalansSection title="Passiva" regels={passivaRegels} totaal={totaalPassiva} />

          {/* Controlegetal */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: isBalanced ? 'var(--success-bg, #f0fdf4)' : 'var(--error-bg, #fff0f0)',
              border: `1px solid ${isBalanced ? 'var(--success-border, #bbf7d0)' : 'var(--error-border, #ffd0d0)'}`,
            }}
          >
            {isBalanced ? (
              <>
                <CheckCircle size={22} strokeWidth={2} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: '#16a34a' }}>Balans klopt</p>
                  <p className="text-xs" style={{ color: '#15803d' }}>Activa = Passiva ({formatEuro(totaalActiva)})</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={22} strokeWidth={2} style={{ color: 'var(--error, #ba1a1a)', flexShrink: 0 }} />
                <div>
                  <p className="text-body-sm font-semibold" style={{ color: 'var(--error, #ba1a1a)' }}>Balans klopt niet</p>
                  <p className="text-xs" style={{ color: 'var(--error, #ba1a1a)' }}>
                    Verschil: {formatEuro(Math.abs(verschil))} ({verschil > 0 ? 'Activa te hoog' : 'Passiva te hoog'})
                  </p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
