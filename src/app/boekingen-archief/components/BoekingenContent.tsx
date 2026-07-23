'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PeriodFilter, { defaultPeriodFilter, isInPeriodFilter, PeriodFilterValue } from '@/components/PeriodFilter';
import { boekingenService, Boeking } from '@/lib/services/boekingenService';
import { createClient } from '@/lib/supabase/client';

type TypeFilter = 'alles' | 'inkoop' | 'verkoop' | 'overig';
type StatusFilter = 'alle' | 'nog_te_verwerken' | 'verwerkt';

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

function exportToCSV(boekingen: Boeking[], periodFilter: PeriodFilterValue): void {
  const headers = ['Datum', 'Partij', 'Omschrijving', 'Type', 'Bedrag incl. BTW', 'BTW %', 'BTW bedrag', 'Bedrag excl. BTW', 'Rekeningcode', 'Tegenrekening'];
  const rows = boekingen.map((b) => [
    b.datum ?? '',
    b.partij ?? '',
    b.omschrijving ?? '',
    b.type ?? '',
    b.bedragInclBtw.toFixed(2).replace('.', ','),
    b.btwPercentage != null ? String(b.btwPercentage) : '',
    b.btwBedrag != null ? b.btwBedrag.toFixed(2).replace('.', ',') : '',
    b.bedragExclBtw != null ? b.bedragExclBtw.toFixed(2).replace('.', ',') : '',
    b.rekeningcode ?? '',
    b.tegenrekening ?? '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  link.download = `boekingen_export_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Rekening options for tegenrekening selector ──────────────────────────────

interface RekeningOptie {
  code: string;
  naam: string;
  categorie: string | null;
}

// ─── Correctie Modal ──────────────────────────────────────────────────────────

interface CorrectieModalProps {
  boeking: Boeking;
  rekeningOpties: RekeningOptie[];
  onClose: () => void;
  onSaved: (updated: Boeking) => void;
}

function CorrectieModal({ boeking, rekeningOpties, onClose, onSaved }: CorrectieModalProps) {
  const [tegenrekening, setTegenrekening] = useState<string>(boeking.tegenrekening ?? '3000');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from('boekingen')
        .update({ tegenrekening: tegenrekening || null })
        .eq('id', boeking.id)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);

      onSaved({
        ...boeking,
        tegenrekening: data.tegenrekening ?? null,
      });
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Boeking corrigeren
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
            aria-label="Sluiten"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Boeking info */}
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <p className="text-label-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {boeking.partij || boeking.omschrijving || '—'}
          </p>
          <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
            {formatDate(boeking.datum)} · {boeking.type} · {formatAmount(boeking.bedragInclBtw)}
          </p>
          {boeking.rekeningcode && (
            <p className="text-label-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Rekening: {boeking.rekeningcode}
            </p>
          )}
        </div>

        {/* Tegenrekening field */}
        <label
          htmlFor="tegenrekening-select"
          className="text-label-md block mb-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Tegenrekening
        </label>
        <select
          id="tegenrekening-select"
          value={tegenrekening}
          onChange={(e) => setTegenrekening(e.target.value)}
          className="w-full rounded-xl px-3 py-3 mb-5 text-body-md outline-none"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--input)',
            color: 'var(--foreground)',
          }}
          aria-label="Tegenrekening selecteren"
        >
          <option value="">— Geen tegenrekening —</option>
          {rekeningOpties.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code} — {r.naam}{r.categorie ? ` (${r.categorie})` : ''}
            </option>
          ))}
        </select>

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4"
            style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
          >
            <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 btn-secondary py-3 disabled:opacity-60"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 btn-primary py-3 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              'Opslaan...'
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                Opslaan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoekingenContent() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>(defaultPeriodFilter());
  const [activeType, setActiveType] = useState<TypeFilter>('alles');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('alle');
  const [boekingen, setBoekingen] = useState<Boeking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [correctieBoeking, setCorrectie] = useState<Boeking | null>(null);
  const [rekeningOpties, setRekeningOpties] = useState<RekeningOptie[]>([]);

  useEffect(() => {
    loadBoekingen();
    loadRekeningen();
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

  const loadRekeningen = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('rekeningschema')
        .select('code, naam, categorie')
        .eq('actief', true)
        .order('code');
      setRekeningOpties(data || []);
    } catch {
      // non-critical
    }
  };

  const filtered = boekingen.filter((b) => {
    const periodMatch = isInPeriodFilter(b.datum, periodFilter);
    const typeMatch = activeType === 'alles' || b.type.toLowerCase() === activeType;
    const statusMatch = activeStatus === 'alle' || activeStatus === 'verwerkt';
    return periodMatch && typeMatch && statusMatch;
  });

  const periodTotal = filtered.reduce((sum, b) => sum + b.bedragInclBtw, 0);

  const handleCorrectieOpgeslagen = (updated: Boeking) => {
    setBoekingen((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setCorrectie(null);
  };

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
        <button
          onClick={() => exportToCSV(filtered, periodFilter)}
          disabled={isLoading || filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-label-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
          aria-label="Exporteer gefilterde boekingen als CSV"
        >
          <Download size={15} strokeWidth={2} aria-hidden="true" />
          Exporteer CSV
        </button>
      </div>

      {/* Period filter */}
      <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />

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
          {filtered.map((boeking) => {
            const isExpanded = expandedId === boeking.id;
            return (
              <div
                key={boeking.id}
                className="card-base transition-colors duration-150 overflow-hidden"
              >
                {/* Main row — tap to expand */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(isExpanded ? null : boeking.id)}
                  aria-expanded={isExpanded}
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
                    <div className="flex items-center gap-2">
                      <span
                        className="text-label-md font-tabular font-bold"
                        style={{ color: 'var(--foreground)', fontSize: '16px' }}
                      >
                        {formatAmount(boeking.bedragInclBtw)}
                      </span>
                      {isExpanded
                        ? <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} />
                        : <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />
                      }
                    </div>
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
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-1"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    {/* Detail rows */}
                    <div className="flex flex-col gap-1.5 mb-4">
                      {boeking.omschrijving && (
                        <div className="flex justify-between text-label-sm">
                          <span style={{ color: 'var(--muted-foreground)' }}>Omschrijving</span>
                          <span style={{ color: 'var(--foreground)' }}>{boeking.omschrijving}</span>
                        </div>
                      )}
                      {boeking.factuurnummer && (
                        <div className="flex justify-between text-label-sm">
                          <span style={{ color: 'var(--muted-foreground)' }}>Factuurnummer</span>
                          <span style={{ color: 'var(--foreground)' }}>{boeking.factuurnummer}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-label-sm">
                        <span style={{ color: 'var(--muted-foreground)' }}>Excl. BTW</span>
                        <span style={{ color: 'var(--foreground)' }}>{formatAmount(boeking.bedragExclBtw)}</span>
                      </div>
                      {boeking.btwBedrag != null && (
                        <div className="flex justify-between text-label-sm">
                          <span style={{ color: 'var(--muted-foreground)' }}>BTW bedrag</span>
                          <span style={{ color: 'var(--foreground)' }}>{formatAmount(boeking.btwBedrag)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-label-sm">
                        <span style={{ color: 'var(--muted-foreground)' }}>Rekeningcode</span>
                        <span style={{ color: 'var(--foreground)' }}>{boeking.rekeningcode || '—'}</span>
                      </div>
                      <div className="flex justify-between text-label-sm">
                        <span style={{ color: 'var(--muted-foreground)' }}>Tegenrekening</span>
                        <span style={{ color: 'var(--foreground)' }}>
                          {boeking.tegenrekening
                            ? (() => {
                                const r = rekeningOpties.find((o) => o.code === boeking.tegenrekening);
                                return r ? `${r.code} — ${r.naam}` : boeking.tegenrekening;
                              })()
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Correctie button */}
                    <button
                      onClick={() => setCorrectie(boeking)}
                      className="w-full btn-secondary py-2.5 text-label-md"
                    >
                      Tegenrekening corrigeren
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Correctie modal */}
      {correctieBoeking && (
        <CorrectieModal
          boeking={correctieBoeking}
          rekeningOpties={rekeningOpties}
          onClose={() => setCorrectie(null)}
          onSaved={handleCorrectieOpgeslagen}
        />
      )}
    </div>
  );
}