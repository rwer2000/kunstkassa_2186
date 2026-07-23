'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { calcWenvRegels, WenvRekeningRegel } from '@/lib/services/boekingenService';

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodMode = 'jaar' | 'kwartaal';

interface WenvPeriod {
  mode: PeriodMode;
  jaar: number;
  kwartaal: 1 | 2 | 3 | 4;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 5; y--) years.push(y);
  return years;
}

function periodToRange(p: WenvPeriod): [string, string] {
  if (p.mode === 'jaar') {
    return [`${p.jaar}-01-01`, `${p.jaar}-12-31`];
  }
  const startMonth = (p.kwartaal - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = endMonth === 3 ? 31 : endMonth === 6 ? 30 : endMonth === 9 ? 30 : 31;
  return [
    `${p.jaar}-${String(startMonth).padStart(2, '0')}-01`,
    `${p.jaar}-${String(endMonth).padStart(2, '0')}-${endDay}`,
  ];
}

function formatEuro(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}€\u00a0${formatted}`;
}

function defaultPeriod(): WenvPeriod {
  const now = new Date();
  return {
    mode: 'jaar',
    jaar: now.getFullYear(),
    kwartaal: (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
  };
}

// ─── Period Picker ────────────────────────────────────────────────────────────

interface PeriodPickerProps {
  value: WenvPeriod;
  onChange: (v: WenvPeriod) => void;
}

function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const years = buildYears();
  const set = (partial: Partial<WenvPeriod>) => onChange({ ...value, ...partial });

  const selectClass = "w-full px-3 py-2.5 rounded-xl text-label-md outline-none appearance-none cursor-pointer";
  const selectStyle = {
    background: 'var(--input)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  };

  return (
    <div className="mb-4">
      {/* Mode radio group */}
      <div
        className="flex items-center rounded-full p-1 mb-3"
        style={{ background: 'var(--muted)' }}
        role="group"
        aria-label="Periode modus"
      >
        {(['jaar', 'kwartaal'] as PeriodMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => set({ mode })}
            className={`flex-1 py-2 text-label-md transition-all duration-200 ${
              value.mode === mode ? 'period-pill-active' : 'period-pill-inactive'
            }`}
            aria-pressed={value.mode === mode}
          >
            {mode === 'jaar' ? 'Jaar' : 'Kwartaal'}
          </button>
        ))}
      </div>

      {/* Compact dropdowns */}
      <div className="flex gap-2">
        {/* Year dropdown */}
        <div className="flex-1">
          <select
            value={value.jaar}
            onChange={(e) => set({ jaar: Number(e.target.value) })}
            className={selectClass}
            style={selectStyle}
            aria-label="Jaar"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Quarter dropdown (only in kwartaal mode) */}
        {value.mode === 'kwartaal' && (
          <div className="flex-1">
            <select
              value={value.kwartaal}
              onChange={(e) => set({ kwartaal: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              className={selectClass}
              style={selectStyle}
              aria-label="Kwartaal"
            >
              <option value={1}>Q1 (jan–mrt)</option>
              <option value={2}>Q2 (apr–jun)</option>
              <option value={3}>Q3 (jul–sep)</option>
              <option value={4}>Q4 (okt–dec)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Table ────────────────────────────────────────────────────────────

interface SectionTableProps {
  title: string;
  rows: WenvRekeningRegel[];
  totaal: number;
  totaalLabel: string;
}

function SectionTable({ title, rows, totaal, totaalLabel }: SectionTableProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Section header */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}
      >
        <span className="text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </span>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div
          key={row.code}
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : undefined,
          }}
        >
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-body-sm truncate" style={{ color: 'var(--foreground)' }}>
              {row.naam}
            </p>
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
              {row.code}
            </p>
          </div>
          <span className="text-body-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
            {formatEuro(row.totaal)}
          </span>
        </div>
      ))}

      {/* Totaal row */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}
      >
        <span className="text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>
          {totaalLabel}
        </span>
        <span className="text-body-md font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
          {formatEuro(totaal)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WenvContent() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<WenvPeriod>(defaultPeriod);
  const [omzetRegels, setOmzetRegels] = useState<WenvRekeningRegel[]>([]);
  const [kostenRegels, setKostenRegels] = useState<WenvRekeningRegel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const [startDatum, eindDatum] = periodToRange(period);
      // Use the central calcWenvRegels function from boekingenService
      const { omzetRegels: omzet, kostenRegels: kosten } = await calcWenvRegels(startDatum, eindDatum);
      setOmzetRegels(omzet);
      setKostenRegels(kosten);
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden.');
    } finally {
      setIsLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totaalOmzet = omzetRegels.reduce((sum, r) => sum + r.totaal, 0);
  const totaalKosten = kostenRegels.reduce((sum, r) => sum + r.totaal, 0);
  const winst = totaalOmzet - totaalKosten;
  const isWinst = winst >= 0;
  const heeftBoekingen = omzetRegels.length > 0 || kostenRegels.length > 0;

  const periodLabel =
    period.mode === 'jaar'
      ? `${period.jaar}`
      : `Q${period.kwartaal} ${period.jaar}`;

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Period picker */}
      <PeriodPicker value={period} onChange={setPeriod} />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <svg
            className="animate-spin w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ color: 'var(--primary)' }}
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          className="rounded-2xl px-4 py-4 text-center"
          style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
        >
          <p className="text-body-sm" style={{ color: '#ba1a1a' }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !heeftBoekingen && (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--muted)' }}
          >
            <Minus size={22} style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-body-md font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
            Geen boekingen gevonden
          </p>
          <p className="text-body-sm" style={{ color: 'var(--muted-foreground)' }}>
            Er zijn geen boekingen voor {periodLabel}.
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && heeftBoekingen && (
        <>
          {/* Omzet section */}
          {omzetRegels.length > 0 && (
            <SectionTable
              title="Omzet"
              rows={omzetRegels}
              totaal={totaalOmzet}
              totaalLabel="Totaal omzet"
            />
          )}

          {/* Kosten section */}
          {kostenRegels.length > 0 && (
            <SectionTable
              title="Kosten"
              rows={kostenRegels}
              totaal={totaalKosten}
              totaalLabel="Totaal kosten"
            />
          )}

          {/* Winst / Verlies card */}
          <div
            className="rounded-2xl px-5 py-5 flex items-center justify-between"
            style={{
              background: isWinst ? 'rgba(22,163,74,0.08)' : 'rgba(186,26,26,0.08)',
              border: `1px solid ${isWinst ? 'rgba(22,163,74,0.25)' : 'rgba(186,26,26,0.25)'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: isWinst ? 'rgba(22,163,74,0.15)' : 'rgba(186,26,26,0.15)',
                }}
              >
                {isWinst ? (
                  <TrendingUp size={20} style={{ color: '#16a34a' }} />
                ) : (
                  <TrendingDown size={20} style={{ color: '#ba1a1a' }} />
                )}
              </div>
              <div>
                <p
                  className="text-label-md font-semibold"
                  style={{ color: isWinst ? '#16a34a' : '#ba1a1a' }}
                >
                  {isWinst ? 'Winst' : 'Verlies'}
                </p>
                <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {periodLabel}
                </p>
              </div>
            </div>
            <span
              className="text-headline-sm font-bold tabular-nums"
              style={{ color: isWinst ? '#16a34a' : '#ba1a1a' }}
            >
              {formatEuro(Math.abs(winst))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
