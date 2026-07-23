'use client';

import React from 'react';

export type FilterMode = 'jaar' | 'kwartaal' | 'maand' | 'custom';

export interface PeriodFilterValue {
  mode: FilterMode;
  jaar: number;
  kwartaal: 1 | 2 | 3 | 4;
  maand: number; // 0-11
  vanDatum: string; // YYYY-MM-DD
  totDatum: string; // YYYY-MM-DD
}

interface PeriodFilterProps {
  value: PeriodFilterValue;
  onChange: (v: PeriodFilterValue) => void;
}

const MAANDEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

function buildYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 5; y--) years.push(y);
  return years;
}

export function defaultPeriodFilter(): PeriodFilterValue {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    mode: 'jaar',
    jaar: now.getFullYear(),
    kwartaal: (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
    maand: now.getMonth(),
    vanDatum: firstOfMonth,
    totDatum: today,
  };
}

/** Returns [start, end] ISO date strings for the given filter */
export function periodFilterToRange(v: PeriodFilterValue): [string, string] {
  if (v.mode === 'custom') {
    return [v.vanDatum, v.totDatum];
  }
  if (v.mode === 'jaar') {
    return [`${v.jaar}-01-01`, `${v.jaar}-12-31`];
  }
  if (v.mode === 'kwartaal') {
    const startMonth = (v.kwartaal - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = endMonth === 3 ? 31 : endMonth === 6 ? 30 : endMonth === 9 ? 30 : 31;
    return [
      `${v.jaar}-${String(startMonth).padStart(2, '0')}-01`,
      `${v.jaar}-${String(endMonth).padStart(2, '0')}-${endDay}`,
    ];
  }
  // maand
  const m = v.maand + 1;
  const lastDay = new Date(v.jaar, v.maand + 1, 0).getDate();
  return [
    `${v.jaar}-${String(m).padStart(2, '0')}-01`,
    `${v.jaar}-${String(m).padStart(2, '0')}-${lastDay}`,
  ];
}

/** Returns true if a boeking.datum falls within the filter range */
export function isInPeriodFilter(datum: string | null, filter: PeriodFilterValue): boolean {
  if (!datum) return false;
  const [start, end] = periodFilterToRange(filter);
  return datum >= start && datum <= end;
}

const selectClass = "w-full px-3 py-2.5 rounded-xl text-label-md outline-none appearance-none cursor-pointer";
const selectStyle = {
  background: 'var(--input)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
};

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const years = buildYears();
  const set = (partial: Partial<PeriodFilterValue>) => onChange({ ...value, ...partial });

  const modes: { key: FilterMode; label: string }[] = [
    { key: 'maand', label: 'Maand' },
    { key: 'kwartaal', label: 'Kwartaal' },
    { key: 'jaar', label: 'Jaar' },
    { key: 'custom', label: 'Aangepast' },
  ];

  return (
    <div className="mb-4">
      {/* Radio group: Aangifte per */}
      <div className="flex items-center gap-1 mb-3 rounded-full p-1" style={{ background: 'var(--muted)' }} role="group" aria-label="Periode modus">
        {modes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => set({ mode: key })}
            className={`flex-1 py-2 text-label-md transition-all duration-200 ${
              value.mode === key ? 'period-pill-active' : 'period-pill-inactive'
            }`}
            aria-pressed={value.mode === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Compact dropdowns for jaar/kwartaal/maand */}
      {value.mode !== 'custom' && (
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

          {/* Month dropdown */}
          {value.mode === 'maand' && (
            <div className="flex-1">
              <select
                value={value.maand}
                onChange={(e) => set({ maand: Number(e.target.value) })}
                className={selectClass}
                style={selectStyle}
                aria-label="Maand"
              >
                {MAANDEN.map((naam, idx) => (
                  <option key={idx} value={idx}>{naam}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quarter dropdown */}
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
      )}

      {/* Custom date range */}
      {value.mode === 'custom' && (
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
              Van
            </label>
            <input
              type="date"
              value={value.vanDatum}
              onChange={(e) => set({ vanDatum: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div className="flex-1">
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
              Tot
            </label>
            <input
              type="date"
              value={value.totDatum}
              onChange={(e) => set({ totDatum: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
