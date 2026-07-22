'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

type Period = 'maand' | 'kwartaal' | 'jaar';
type TypeFilter = 'alles' | 'inkoop' | 'verkoop' | 'overig';
type StatusFilter = 'alle' | 'nog_te_verwerken' | 'verwerkt';

interface Boeking {
  id: string;
  date: string;
  party: string;
  amount: string;
  grootboekrekening: string;
  btwPercentage: string;
  type: 'inkoop' | 'verkoop' | 'overig';
  status: 'verwerkt' | 'nog_te_verwerken';
}

// Backend integration point: replace with real data from database
const allBoekingen: Boeking[] = [
  {
    id: 'boeking-001',
    date: '14 okt',
    party: 'Apple Store',
    amount: '€ 1.299,00',
    grootboekrekening: 'THEATERMATERIAAL',
    btwPercentage: '21%',
    type: 'inkoop',
    status: 'nog_te_verwerken',
  },
  {
    id: 'boeking-002',
    date: '12 okt',
    party: 'Belastingdienst',
    amount: '€ 842,00',
    grootboekrekening: 'OVERIG',
    btwPercentage: '0%',
    type: 'overig',
    status: 'verwerkt',
  },
  {
    id: 'boeking-003',
    date: '10 okt',
    party: 'NS Zakelijk',
    amount: '€ 45,60',
    grootboekrekening: 'REISKOSTEN KM',
    btwPercentage: '9%',
    type: 'inkoop',
    status: 'verwerkt',
  },
  {
    id: 'boeking-004',
    date: '08 okt',
    party: 'Starbucks Utrecht',
    amount: '€ 7,45',
    grootboekrekening: 'ETEN EN DRINKEN',
    btwPercentage: '9%',
    type: 'inkoop',
    status: 'nog_te_verwerken',
  },
  {
    id: 'boeking-005',
    date: '06 okt',
    party: 'Gemeente Amsterdam',
    amount: '€ 215,00',
    grootboekrekening: 'VERGUNNINGEN',
    btwPercentage: '0%',
    type: 'overig',
    status: 'verwerkt',
  },
  {
    id: 'boeking-006',
    date: '05 okt',
    party: 'Theater De Balie',
    amount: '€ 3.500,00',
    grootboekrekening: 'OMZET DIENSTEN',
    btwPercentage: '21%',
    type: 'verkoop',
    status: 'verwerkt',
  },
  {
    id: 'boeking-007',
    date: '03 okt',
    party: 'HEMA Kantoor',
    amount: '€ 34,90',
    grootboekrekening: 'KANTOORBENODIGDH.',
    btwPercentage: '21%',
    type: 'inkoop',
    status: 'nog_te_verwerken',
  },
  {
    id: 'boeking-008',
    date: '01 okt',
    party: 'Cultuurhuis Zaandam',
    amount: '€ 1.200,00',
    grootboekrekening: 'OMZET DIENSTEN',
    btwPercentage: '21%',
    type: 'verkoop',
    status: 'verwerkt',
  },
  {
    id: 'boeking-009',
    date: '29 sep',
    party: 'Coolblue',
    amount: '€ 349,00',
    grootboekrekening: 'APPARATUUR',
    btwPercentage: '21%',
    type: 'inkoop',
    status: 'nog_te_verwerken',
  },
  {
    id: 'boeking-010',
    date: '27 sep',
    party: 'Shell Brandstof',
    amount: '€ 68,20',
    grootboekrekening: 'REISKOSTEN AUTO',
    btwPercentage: '21%',
    type: 'inkoop',
    status: 'verwerkt',
  },
];

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

const periodTotals: Record<Period, string> = {
  maand: '€ 1.432,50',
  kwartaal: '€ 4.560,20',
  jaar: '€ 18.340,75',
};

export default function BoekingenContent() {
  const [activePeriod, setActivePeriod] = useState<Period>('kwartaal');
  const [activeType, setActiveType] = useState<TypeFilter>('alles');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('alle');

  const filtered = allBoekingen.filter((b) => {
    const typeMatch = activeType === 'alles' || b.type === activeType;
    const statusMatch = activeStatus === 'alle' || b.status === activeStatus;
    return typeMatch && statusMatch;
  });

  const pendingCount = allBoekingen.filter((b) => b.status === 'nog_te_verwerken').length;

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
        <p
          className="text-display-lg font-tabular mb-3 text-white"
        >
          {periodTotals[activePeriod]}
        </p>

        {pendingCount > 0 && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: 'rgba(255, 237, 213, 0.18)', border: '1px solid rgba(255, 186, 120, 0.4)' }}
          >
            <AlertCircle size={13} style={{ color: '#fdba74' }} strokeWidth={2} aria-hidden="true" />
            <span
              className="text-label-sm"
              style={{ color: '#fdba74' }}
            >
              {pendingCount} onverwerkte documenten
            </span>
          </div>
        )}
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

      {/* Boekingen list */}
      {filtered.length === 0 ? (
        <div
          className="card-base flex flex-col items-center justify-center py-12 px-6 text-center"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--muted)' }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--muted-foreground)' }}
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-headline-sm mb-1.5" style={{ color: 'var(--foreground)' }}>
            Geen boekingen gevonden
          </p>
          <p className="text-body-md" style={{ color: 'var(--muted-foreground)' }}>
            Er zijn geen boekingen die overeenkomen met de geselecteerde filters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-6">
          {filtered.map((boeking) => (
            <div
              key={boeking.id}
              className="card-base p-4 transition-colors duration-150 active:bg-muted cursor-pointer"
            >
              {/* Top row: date + amount */}
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-label-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {boeking.date}
                  </p>
                  <p
                    className="font-semibold text-base"
                    style={{ color: 'var(--foreground)', fontSize: '16px', lineHeight: '22px' }}
                  >
                    {boeking.party}
                  </p>
                </div>
                <span
                  className="text-label-md font-tabular font-bold"
                  style={{ color: 'var(--foreground)', fontSize: '16px' }}
                >
                  {boeking.amount}
                </span>
              </div>

              {/* Bottom row: tags + status */}
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {/* Grootboekrekening tag */}
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
                  {boeking.grootboekrekening}
                </span>

                {/* BTW badge */}
                <span
                  className="text-label-sm px-2 py-0.5 rounded"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--secondary)',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  BTW {boeking.btwPercentage}
                </span>

                {/* Status badge */}
                <StatusBadge status={boeking.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}