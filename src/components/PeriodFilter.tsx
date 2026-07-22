'use client';

import React, { useState, useEffect } from 'react';


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

const MODES: { key: FilterMode; label: string }[] = [
  { key: 'jaar', label: 'Jaar' },
  { key: 'kwartaal', label: 'Kwartaal' },
  { key: 'maand', label: 'Maand' },
  { key: 'custom', label: 'Aangepast' },
];

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

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const years = buildYears();

  const set = (partial: Partial<PeriodFilterValue>) => onChange({ ...value, ...partial });

  return (
    <div className="mb-4">
      {/* Mode tabs */}
      <div
        className="flex items-center rounded-full p-1 mb-3"
        style={{ background: 'var(--muted)' }}
        role="group"
        aria-label="Periode modus"
      >
        {MODES.map(({ key, label }) => (
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

      {/* Jaar */}
      {value.mode === 'jaar' && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => set({ jaar: y })}
              className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
                value.jaar === y ? 'filter-chip-active' : 'filter-chip-inactive'
              }`}
              aria-pressed={value.jaar === y}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Kwartaal */}
      {value.mode === 'kwartaal' && (
        <div className="flex flex-col gap-2">
          {/* Year selector */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => set({ jaar: y })}
                className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
                  value.jaar === y ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
                aria-pressed={value.jaar === y}
              >
                {y}
              </button>
            ))}
          </div>
          {/* Quarter selector */}
          <div className="flex gap-2">
            {([1, 2, 3, 4] as const).map((q) => (
              <button
                key={q}
                onClick={() => set({ kwartaal: q })}
                className={`flex-1 py-2 text-label-sm font-semibold transition-all duration-200 ${
                  value.kwartaal === q ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
                aria-pressed={value.kwartaal === q}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Maand */}
      {value.mode === 'maand' && (
        <div className="flex flex-col gap-2">
          {/* Year selector */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => set({ jaar: y })}
                className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
                  value.jaar === y ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
                aria-pressed={value.jaar === y}
              >
                {y}
              </button>
            ))}
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-2">
            {MAANDEN.map((naam, idx) => (
              <button
                key={idx}
                onClick={() => set({ maand: idx })}
                className={`py-2 text-label-sm font-semibold transition-all duration-200 ${
                  value.maand === idx ? 'filter-chip-active' : 'filter-chip-inactive'
                }`}
                aria-pressed={value.maand === idx}
              >
                {naam.slice(0, 3)}
              </button>
            ))}
          </div>
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
