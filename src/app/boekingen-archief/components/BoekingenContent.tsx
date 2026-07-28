'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, X, Check, Trash2, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PeriodFilter, { defaultPeriodFilter, isInPeriodFilter, PeriodFilterValue } from '@/components/PeriodFilter';
import { boekingenService, Boeking } from '@/lib/services/boekingenService';
import { createClient } from '@/lib/supabase/client';
import DocumentViewerModal from '@/components/DocumentViewerModal';

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

const BTW_OPTIES = [0, 9, 21];

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

interface RekeningOptie {
  code: string;
  naam: string;
  categorie: string | null;
}

// ─── Bewerken Modal ───────────────────────────────────────────────────────────

interface BewerkenModalProps {
  boeking: Boeking;
  rekeningOpties: RekeningOptie[];
  onClose: () => void;
  onSaved: (updated: Boeking) => void;
  onDeleted: (id: string) => void;
}

function BewerkenModal({ boeking, rekeningOpties, onClose, onSaved, onDeleted }: BewerkenModalProps) {
  const [datum, setDatum] = useState<string>(boeking.datum ?? '');
  const [type, setType] = useState<'Inkoop' | 'Verkoop' | 'Overig'>(boeking.type);
  const [partij, setPartij] = useState<string>(boeking.partij ?? '');
  const [omschrijving, setOmschrijving] = useState<string>(boeking.omschrijving ?? '');
  const [factuurnummer, setFactuurnummer] = useState<string>(boeking.factuurnummer ?? '');
  const [rekeningcode, setRekeningcode] = useState<string>(boeking.rekeningcode ?? '');
  const [tegenrekening, setTegenrekening] = useState<string>(boeking.tegenrekening ?? '3000');
  const [btwPercentage, setBtwPercentage] = useState<number>(boeking.btwPercentage ?? 21);
  const [bedragMode, setBedragMode] = useState<'incl' | 'excl'>('incl');
  const [bedragInput, setBedragInput] = useState<string>(boeking.bedragInclBtw.toFixed(2).replace('.', ','));

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Recalculate derived amounts
  function calcBedragen(mode: 'incl' | 'excl', rawInput: string, btwPct: number) {
    const val = parseFloat(rawInput.replace(',', '.')) || 0;
    let bedragExcl: number;
    let btwBedrag: number;
    let bedragIncl: number;

    if (mode === 'incl') {
      bedragIncl = val;
      if (btwPct === 0) {
        bedragExcl = val;
        btwBedrag = 0;
      } else {
        bedragExcl = val / (1 + btwPct / 100);
        btwBedrag = val - bedragExcl;
      }
    } else {
      bedragExcl = val;
      btwBedrag = val * (btwPct / 100);
      bedragIncl = val + btwBedrag;
    }

    return {
      bedragExcl: Math.round(bedragExcl * 100) / 100,
      btwBedrag: Math.round(btwBedrag * 100) / 100,
      bedragIncl: Math.round(bedragIncl * 100) / 100,
    };
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { bedragExcl, btwBedrag, bedragIncl } = calcBedragen(bedragMode, bedragInput, btwPercentage);

      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from('boekingen')
        .update({
          datum: datum || null,
          type,
          partij: partij || null,
          omschrijving: omschrijving || null,
          factuurnummer: factuurnummer || null,
          rekeningcode: rekeningcode || null,
          tegenrekening: tegenrekening || null,
          btw_percentage: btwPercentage,
          btw_bedrag: btwBedrag,
          bedrag_excl_btw: bedragExcl,
          bedrag_incl_btw: bedragIncl,
        })
        .eq('id', boeking.id)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);

      setSaved(true);
      setTimeout(() => {
        onSaved({
          ...boeking,
          datum: data.datum ?? null,
          type: data.type,
          partij: data.partij ?? null,
          omschrijving: data.omschrijving ?? null,
          factuurnummer: data.factuurnummer ?? null,
          rekeningcode: data.rekeningcode ?? null,
          tegenrekening: data.tegenrekening ?? null,
          btwPercentage: data.btw_percentage != null ? Number(data.btw_percentage) : null,
          btwBedrag: data.btw_bedrag != null ? Number(data.btw_bedrag) : null,
          bedragExclBtw: Number(data.bedrag_excl_btw ?? 0),
          bedragInclBtw: Number(data.bedrag_incl_btw ?? 0),
        });
      }, 900);
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('boekingen')
        .delete()
        .eq('id', boeking.id);

      if (deleteError) throw new Error(deleteError.message);
      onDeleted(boeking.id);
    } catch (err: any) {
      setError(err?.message || 'Verwijderen mislukt.');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const fieldClass = "w-full rounded-xl px-3 py-2.5 text-body-md outline-none";
  const fieldStyle = {
    border: '1px solid var(--border)',
    background: 'var(--input)',
    color: 'var(--foreground)',
  };
  const labelClass = "text-label-sm block mb-1";
  const labelStyle = { color: 'var(--muted-foreground)' };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Boeking bewerken
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
            aria-label="Sluiten"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">

          {/* Datum + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Datum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Inkoop' | 'Verkoop' | 'Overig')}
                className={fieldClass}
                style={fieldStyle}
              >
                <option value="Inkoop">Inkoop</option>
                <option value="Verkoop">Verkoop</option>
                <option value="Overig">Overig</option>
              </select>
            </div>
          </div>

          {/* Partij */}
          <div>
            <label className={labelClass} style={labelStyle}>Partij</label>
            <input
              type="text"
              value={partij}
              onChange={(e) => setPartij(e.target.value)}
              placeholder="Naam leverancier of klant"
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          {/* Omschrijving */}
          <div>
            <label className={labelClass} style={labelStyle}>Omschrijving</label>
            <input
              type="text"
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="Omschrijving"
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          {/* Factuurnummer */}
          <div>
            <label className={labelClass} style={labelStyle}>Factuurnummer</label>
            <input
              type="text"
              value={factuurnummer}
              onChange={(e) => setFactuurnummer(e.target.value)}
              placeholder="Factuurnummer (optioneel)"
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          {/* Bedrag mode toggle + input */}
          <div>
            <label className={labelClass} style={labelStyle}>Bedrag</label>
            <div className="flex gap-2 mb-2">
              {(['incl', 'excl'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBedragMode(m)}
                  className={`flex-1 py-2 rounded-xl text-label-sm font-semibold transition-all duration-150 ${
                    bedragMode === m ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {m === 'incl' ? 'Incl. BTW' : 'Excl. BTW'}
                </button>
              ))}
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={bedragInput}
              onChange={(e) => setBedragInput(e.target.value)}
              placeholder="0,00"
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          {/* BTW % */}
          <div>
            <label className={labelClass} style={labelStyle}>BTW %</label>
            <div className="flex gap-2">
              {BTW_OPTIES.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBtwPercentage(pct)}
                  className={`flex-1 py-2 rounded-xl text-label-sm font-semibold transition-all duration-150 ${
                    btwPercentage === pct ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Rekeningcode */}
          <div>
            <label className={labelClass} style={labelStyle}>Rekeningcode</label>
            <select
              value={rekeningcode}
              onChange={(e) => setRekeningcode(e.target.value)}
              className={fieldClass}
              style={fieldStyle}
            >
              <option value="">— Geen rekening —</option>
              {rekeningOpties.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.naam}{r.categorie ? ` (${r.categorie})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tegenrekening */}
          <div>
            <label className={labelClass} style={labelStyle}>Tegenrekening</label>
            <select
              value={tegenrekening}
              onChange={(e) => setTegenrekening(e.target.value)}
              className={fieldClass}
              style={fieldStyle}
            >
              <option value="">— Geen tegenrekening —</option>
              {rekeningOpties.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.naam}{r.categorie ? ` (${r.categorie})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Berekend preview */}
          {(() => {
            const { bedragExcl, btwBedrag, bedragIncl } = calcBedragen(bedragMode, bedragInput, btwPercentage);
            return (
              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-1"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <div className="flex justify-between text-label-sm">
                  <span style={{ color: 'var(--muted-foreground)' }}>Excl. BTW</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatAmount(bedragExcl)}</span>
                </div>
                <div className="flex justify-between text-label-sm">
                  <span style={{ color: 'var(--muted-foreground)' }}>BTW ({btwPercentage}%)</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatAmount(btwBedrag)}</span>
                </div>
                <div className="flex justify-between text-label-sm font-semibold">
                  <span style={{ color: 'var(--foreground)' }}>Incl. BTW</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatAmount(bedragIncl)}</span>
                </div>
              </div>
            );
          })()}

          {error && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
            >
              <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
            </div>
          )}

          {saved && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <Check size={15} style={{ color: '#16a34a' }} />
              <span className="text-label-sm font-semibold" style={{ color: '#16a34a' }}>Boeking bijgewerkt</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-6 pt-3 flex-shrink-0 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="flex-1 btn-secondary py-3 disabled:opacity-60"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting || saved}
              className="flex-1 btn-primary py-3 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSaving ? 'Opslaan...' : saved ? (
                <><Check size={16} strokeWidth={2.5} /> Opgeslagen</>
              ) : (
                <><Check size={16} strokeWidth={2.5} /> Opslaan</>
              )}
            </button>
          </div>

          {/* Delete section */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving || isDeleting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-label-md font-semibold transition-all duration-150 disabled:opacity-60"
              style={{ color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.25)', background: 'rgba(186,26,26,0.05)' }}
            >
              <Trash2 size={15} strokeWidth={2} />
              Boeking verwijderen
            </button>
          ) : (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.2)' }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} style={{ color: '#ba1a1a', flexShrink: 0, marginTop: 2 }} />
                <p className="text-label-sm" style={{ color: '#ba1a1a' }}>
                  Weet je zeker dat je deze boeking wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 btn-secondary py-2 text-label-sm disabled:opacity-60"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl text-label-sm font-semibold transition-all duration-150 disabled:opacity-60"
                  style={{ background: '#ba1a1a', color: '#fff' }}
                >
                  {isDeleting ? 'Verwijderen...' : 'Ja, verwijderen'}
                </button>
              </div>
            </div>
          )}
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
  const [bewerkenBoeking, setBewerkenBoeking] = useState<Boeking | null>(null);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);
  const [rekeningOpties, setRekeningOpties] = useState<RekeningOptie[]>([]);
  const [rekeningFilter, setRekeningFilter] = useState<string>('alle');

  useEffect(() => {
    loadBoekingen();
    loadRekeningen();
    // Diepe link vanuit W&V/Balans: ?rekening=<code> filtert meteen op die rekening
    const params = new URLSearchParams(window.location.search);
    const rekening = params.get('rekening');
    if (rekening) setRekeningFilter(rekening);
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
    const rekeningMatch =
      rekeningFilter === 'alle' || b.rekeningcode === rekeningFilter || b.tegenrekening === rekeningFilter;
    return periodMatch && typeMatch && statusMatch && rekeningMatch;
  });

  const actieveRekeningOptie = rekeningOpties.find((r) => r.code === rekeningFilter);

  const periodTotal = filtered.reduce((sum, b) => sum + b.bedragInclBtw, 0);

  const handleBewerkenOpgeslagen = (updated: Boeking) => {
    setBoekingen((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setBewerkenBoeking(null);
    setExpandedId(null);
  };

  const handleVerwijderd = (id: string) => {
    setBoekingen((prev) => prev.filter((b) => b.id !== id));
    setBewerkenBoeking(null);
    setExpandedId(null);
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

      {/* Rekening filter */}
      <div className="mb-5">
        <label
          htmlFor="rekening-filter"
          className="text-label-sm block mb-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Rekening
        </label>
        <div className="flex items-center gap-2">
          <select
            id="rekening-filter"
            value={rekeningFilter}
            onChange={(e) => setRekeningFilter(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl text-label-md outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="alle">Alle rekeningen</option>
            {rekeningOpties.map((r) => (
              <option key={r.code} value={r.code}>{r.code} — {r.naam}</option>
            ))}
          </select>
          {rekeningFilter !== 'alle' && (
            <button
              onClick={() => setRekeningFilter('alle')}
              className="flex-shrink-0 px-3 py-2.5 rounded-xl text-label-sm font-semibold btn-secondary"
              aria-label="Rekeningfilter wissen"
            >
              Wissen
            </button>
          )}
        </div>
        {rekeningFilter !== 'alle' && actieveRekeningOptie && (
          <p className="text-label-sm mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
            Toont boekingen waar {actieveRekeningOptie.naam} de rekening óf de tegenrekening is.
          </p>
        )}
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

                    {/* Bekijk factuur + bewerken buttons */}
                    <div className="flex gap-2">
                      {boeking.brondocumentId && (
                        <button
                          onClick={() => setViewDocumentId(boeking.brondocumentId as string)}
                          className="flex-1 flex items-center justify-center gap-1.5 btn-secondary py-2.5 text-label-md"
                        >
                          <FileText size={15} strokeWidth={2} />
                          Bekijk factuur
                        </button>
                      )}
                      <button
                        onClick={() => setBewerkenBoeking(boeking)}
                        className="flex-1 btn-secondary py-2.5 text-label-md"
                      >
                        Boeking bewerken
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bewerken modal */}
      {bewerkenBoeking && (
        <BewerkenModal
          boeking={bewerkenBoeking}
          rekeningOpties={rekeningOpties}
          onClose={() => setBewerkenBoeking(null)}
          onSaved={handleBewerkenOpgeslagen}
          onDeleted={handleVerwijderd}
        />
      )}

      {/* Factuur-viewer */}
      {viewDocumentId && (
        <DocumentViewerModal documentId={viewDocumentId} onClose={() => setViewDocumentId(null)} />
      )}
    </div>
  );
}