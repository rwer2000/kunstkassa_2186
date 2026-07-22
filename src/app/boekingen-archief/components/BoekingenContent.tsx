'use client';

import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { boekingenService, Boeking } from '@/lib/services/boekingenService';

type Period = 'maand' | 'kwartaal' | 'jaar';
type TypeFilter = 'alles' | 'inkoop' | 'verkoop' | 'overig';
type StatusFilter = 'alle' | 'nog_te_verwerken' | 'verwerkt';

const periodLabels: { key: Period; label: string }[] = [
  { key: 'maand', label: 'Maand' },
  { key: 'kwartaal', label: 'Kwartaal' },
  { key: 'jaar', label: 'Jaar' },
];

const typeFilters: { key: TypeFilter; label: string }[] = [
  { key: 'alles', label: 'Alles' },
  { key: 'inkoop', label: 'Inkoop' },
  { key: 'verkoop', label: 'Verkoop' },
  { key: 'overig', label: 'Overig' },
];

const statusFilterOptions: { key: StatusFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'nog_te_verwerken', label: 'Nog te verwerken' },
  { key: 'verwerkt', label: 'Verwerkt' },
];

function formatAmount(amount: number): string {
  return `€ ${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isInPeriod(boeking: Boeking, period: Period): boolean {
  if (!boeking.datum) return false;
  const d = new Date(boeking.datum);
  const now = new Date();
  if (period === 'maand') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === 'kwartaal') {
    const q = Math.floor(now.getMonth() / 3);
    const bq = Math.floor(d.getMonth() / 3);
    return d.getFullYear() === now.getFullYear() && bq === q;
  }
  if (period === 'jaar') {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

export default function BoekingenContent() {
  const [activePeriod, setActivePeriod] = useState<Period>('kwartaal');
  const [activeType, setActiveType] = useState<TypeFilter>('alles');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('alle');
  const [boekingen, setBoekingen] = useState<Boeking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBoekingen();
  }, []);

  const loadBoekingen = async () => {
    setIsLoading(true);
    try {
      const data = await boekingenService.getBoekingen();
      setBoekingen(data);
    } catch (err) {
      console.error('loadBoekingen error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = boekingen.filter((b) => {
    const periodMatch = isInPeriod(b, activePeriod);
    const typeMatch = activeType === 'alles' || b.type.toLowerCase() === activeType;
    // All boekingen are 'verwerkt' by definition; nog_te_verwerken filter shows nothing
    const statusMatch = activeStatus === 'alle' || activeStatus === 'verwerkt';
    return periodMatch && typeMatch && statusMatch;
  });

  const periodTotal = filtered.reduce((sum, b) => sum + b.bedragInclBtw, 0);

  return (
    <div className="px-5 max-w-lg mx-auto pt-2">
      {/* Dark summary card */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--primary)' }}
      >
        <p
          className="text-label-md mb-2 tracking-widest"
          style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em' }}
        >
          TOTAALBEDRAG DEZE PERIODE
        </p>
        <p className="text-display-lg font-tabular mb-3 text-white">
          {isLoading ? (
            <span className="inline-block w-32 h-8 rounded animate-pulse opacity-40" style={{ background: 'white' }} />
          ) : (
            formatAmount(periodTotal)
          )}
        </p>
      </div>

      {/* Period toggle */}
      <div
        className="flex items-center rounded-full p-1 mb-4"
        style={{ background: 'var(--muted)' }}
        role="group"
        aria-label="Periode selecteren"
      >
        {periodLabels.map(({ key, label }) => (
          <button
            key={`period-${key}`}
            onClick={() => setActivePeriod(key)}
            className={`flex-1 py-2 text-label-md transition-all duration-200 ${
              activePeriod === key ? 'period-pill-active' : 'period-pill-inactive'
            }`}
            aria-pressed={activePeriod === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Type filter chips */}
      <div
        className="flex items-center gap-2 mb-3 overflow-x-auto pb-1"
        role="group"
        aria-label="Type filter"
        style={{ scrollbarWidth: 'none' }}
      >
        {typeFilters.map(({ key, label }) => (
          <button
            key={`type-${key}`}
            onClick={() => setActiveType(key)}
            className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
              activeType === key ? 'filter-chip-active' : 'filter-chip-inactive'
            }`}
            aria-pressed={activeType === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status filter chips */}
      <div
        className="flex items-center gap-2 mb-5 overflow-x-auto pb-1"
        role="group"
        aria-label="Status filter"
        style={{ scrollbarWidth: 'none' }}
      >
        {statusFilterOptions.map(({ key, label }) => (
          <button
            key={`status-${key}`}
            onClick={() => setActiveStatus(key)}
            className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
              activeStatus === key ? 'filter-chip-active' : 'filter-chip-inactive'
            }`}
            aria-pressed={activeStatus === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Boekingen section header */}
      <h2
        className="text-headline-sm mb-3"
        style={{ color: 'var(--foreground)' }}
      >
        Recente Boekingen
      </h2>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-base p-4 animate-pulse">
              <div className="flex justify-between mb-2">
                <div className="space-y-1.5">
                  <div className="h-3 rounded w-20" style={{ background: 'var(--input)' }} />
                  <div className="h-4 rounded w-32" style={{ background: 'var(--input)' }} />
                </div>
                <div className="h-4 rounded w-16" style={{ background: 'var(--input)' }} />
              </div>
              <div className="flex gap-2">
                <div className="h-5 rounded w-16" style={{ background: 'var(--input)' }} />
                <div className="h-5 rounded w-16" style={{ background: 'var(--input)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-base flex flex-col items-center justify-center py-14 px-6 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--muted)' }}
          >
            <FileText size={26} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          </div>
          <p className="text-headline-sm mb-2" style={{ color: 'var(--foreground)' }}>
            Nog geen boekingen
          </p>
          <p className="text-body-md max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
            {boekingen.length > 0
              ? 'Geen boekingen gevonden voor deze periode of filter.' :'Open een bonnetje op het dashboard en kies "Verwerk als boeking" om te starten.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-6">
          {filtered.map((boeking) => (
            <div
              key={boeking.id}
              className="card-base p-4 transition-colors duration-150"
            >
              {/* Top row: date + amount */}
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-label-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDate(boeking.datum)}
                  </p>
                  <p
                    className="font-semibold text-base"
                    style={{ color: 'var(--foreground)', fontSize: '16px', lineHeight: '22px' }}
                  >
                    {boeking.partij || boeking.omschrijving || '—'}
                  </p>
                </div>
                <span
                  className="text-label-md font-tabular font-bold"
                  style={{ color: 'var(--foreground)', fontSize: '16px' }}
                >
                  {formatAmount(boeking.bedragInclBtw)}
                </span>
              </div>

              {/* Bottom row: tags */}
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span
                  className="text-label-sm px-2 py-0.5 rounded"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  {boeking.type}
                </span>
                {boeking.btwPercentage != null && (
                  <span
                    className="text-label-sm px-2 py-0.5 rounded"
                    style={{
                      background: 'var(--muted)',
                      color: 'var(--secondary)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    BTW {boeking.btwPercentage}%
                  </span>
                )}
                {boeking.rekeningcode && (
                  <span
                    className="text-label-sm px-2 py-0.5 rounded"
                    style={{
                      background: 'var(--muted)',
                      color: 'var(--muted-foreground)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    {boeking.rekeningcode}
                  </span>
                )}
                <StatusBadge status="verwerkt" size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}