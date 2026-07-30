'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Plus,
  FileText,
  X,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { btwService, OpenstaandSaldo, KwartaalMetBoekingen, BtwKwartaal, huidigKwartaal } from '@/lib/services/btwService';
import { calcBtwSaldo } from '@/lib/services/boekingenService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEuro(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}€\u00a0${formatted}`;
}

function formatDatum(datum: string | null): string {
  if (!datum) return '—';
  const d = new Date(datum);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function periodeLabel(periode: string): string {
  // "2026-Q1" → "Q1 2026"
  const parts = periode.split('-');
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return periode;
}

// ─── Indienen Modal ───────────────────────────────────────────────────────────

interface IndienenModalProps {
  openstaand: OpenstaandSaldo;
  onClose: () => void;
  onSuccess: (kwartaal: BtwKwartaal) => void;
}

function buildPeriodeOptiesIndienen(): string[] {
  const opties: string[] = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const q = Math.floor(d.getMonth() / 3) + 1;
    opties.push(`${d.getFullYear()}-Q${q}`);
  }
  return [...new Set(opties)];
}

function IndienenModal({ openstaand, onClose, onSuccess }: IndienenModalProps) {
  const periodeOpties = buildPeriodeOptiesIndienen();
  const [periode, setPeriode] = useState(huidigKwartaal());
  const [bedrag, setBedrag] = useState(
    openstaand.berekendSaldo.toFixed(2).replace('.', ',')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    const parsed = parseFloat(bedrag.replace(',', '.'));
    if (isNaN(parsed)) {
      setError('Voer een geldig bedrag in.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let brondocumentPad: string | undefined;
      if (pdfFile) {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const timestamp = Date.now();
          const sanitized = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${user.id}/${timestamp}_${sanitized}`;
          const { error: uploadError } = await supabase.storage
            .from('btw-aangiften')
            .upload(filePath, pdfFile, { cacheControl: '3600', upsert: false });
          if (!uploadError) brondocumentPad = filePath;
        }
      }
      const result = await btwService.dienOpenstaandSaldoIn(
        periode,
        parsed,
        brondocumentPad
      );
      if (result) onSuccess(result);
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Kwartaal indienen
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
            aria-label="Sluiten"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <label className="text-label-md mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
          Voor welk kwartaal dien je dit in?
        </label>
        <select
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-body-md outline-none appearance-none cursor-pointer mb-4"
          style={{ border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)' }}
        >
          {periodeOpties.map((p) => (
            <option key={p} value={p}>{periodeLabel(p)}</option>
          ))}
        </select>

        <p className="text-label-md mb-1" style={{ color: 'var(--muted-foreground)' }}>
          Openstaand saldo (Verkoop BTW − Inkoop BTW, alle nog niet ingediende boekingen)
        </p>
        <p className="text-body-md mb-4" style={{ color: 'var(--foreground)' }}>
          {formatEuro(openstaand.berekendSaldo)}
        </p>

        <label className="text-label-md mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
          Ingediend bedrag (aanpasbaar)
        </label>
        <div
          className="flex items-center rounded-xl px-3 mb-4"
          style={{ border: '1px solid var(--border)', background: 'var(--input)' }}
        >
          <span className="text-label-md mr-2" style={{ color: 'var(--muted-foreground)' }}>€</span>
          <input
            type="text"
            inputMode="decimal"
            value={bedrag}
            onChange={(e) => setBedrag(e.target.value)}
            className="flex-1 py-3 bg-transparent text-body-md outline-none"
            style={{ color: 'var(--foreground)' }}
            aria-label="Ingediend bedrag"
          />
        </div>

        {/* Optional PDF upload */}
        <button
          type="button"
          onClick={() => pdfRef.current?.click()}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-label-md transition-colors"
          style={{
            border: '1px dashed var(--border)',
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          <Upload size={16} strokeWidth={2} />
          {pdfFile ? pdfFile.name : 'PDF bijlage toevoegen (optioneel)'}
        </button>
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          aria-label="PDF bijlage selecteren"
        />

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4"
            style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
          >
            <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
            <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 btn-secondary py-3 disabled:opacity-60"
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 btn-primary py-3 disabled:opacity-60"
          >
            {isSubmitting ? 'Indienen...' : 'Bevestigen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Historisch Kwartaal Modal ────────────────────────────────────────────────

interface HistorischModalProps {
  onClose: () => void;
  onSuccess: (kwartaal: BtwKwartaal) => void;
}

function HistorischModal({ onClose, onSuccess }: HistorischModalProps) {
  const [periode, setPeriode] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  // Generate period options: last 12 quarters
  const periodeOpties: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const q = Math.floor(d.getMonth() / 3) + 1;
    periodeOpties.push(`${d.getFullYear()}-Q${q}`);
  }
  // Deduplicate
  const uniqueOpties = Array.from(new Set(periodeOpties));

  const handleSubmit = async () => {
    if (!periode) { setError('Selecteer een periode.'); return; }
    const parsed = parseFloat(bedrag.replace(',', '.'));
    if (isNaN(parsed)) { setError('Voer een geldig bedrag in.'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await btwService.historischKwartaalToevoegen(periode, parsed, pdfFile ?? undefined);
      if (result) onSuccess(result);
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Historisch kwartaal toevoegen
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
            aria-label="Sluiten"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <label className="text-label-md mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
          Periode
        </label>
        <select
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="w-full rounded-xl px-3 py-3 mb-4 text-body-md outline-none"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--input)',
            color: 'var(--foreground)',
          }}
          aria-label="Periode selecteren"
        >
          <option value="">Selecteer periode</option>
          {uniqueOpties.map((p) => (
            <option key={p} value={p}>{periodeLabel(p)}</option>
          ))}
        </select>

        <label className="text-label-md mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
          Ingediend bedrag
        </label>
        <div
          className="flex items-center rounded-xl px-3 mb-4"
          style={{ border: '1px solid var(--border)', background: 'var(--input)' }}
        >
          <span className="text-label-md mr-2" style={{ color: 'var(--muted-foreground)' }}>€</span>
          <input
            type="text"
            inputMode="decimal"
            value={bedrag}
            onChange={(e) => setBedrag(e.target.value)}
            placeholder="0,00"
            className="flex-1 py-3 bg-transparent text-body-md outline-none"
            style={{ color: 'var(--foreground)' }}
            aria-label="Ingediend bedrag"
          />
        </div>

        <button
          type="button"
          onClick={() => pdfRef.current?.click()}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-label-md transition-colors"
          style={{
            border: '1px dashed var(--border)',
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          <Upload size={16} strokeWidth={2} />
          {pdfFile ? pdfFile.name : 'PDF bijlage toevoegen (optioneel)'}
        </button>
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          aria-label="PDF bijlage selecteren"
        />

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4"
            style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
          >
            <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
            <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="flex-1 btn-secondary py-3 disabled:opacity-60">
            Annuleren
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 btn-primary py-3 disabled:opacity-60">
            {isSubmitting ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Periode Card ─────────────────────────────────────────────────────────────

interface PeriodeCardProps {
  item: KwartaalMetBoekingen;
}

function PeriodeCard({ item }: PeriodeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { kwartaal, boekingen } = item;
  const toonBedrag = kwartaal.ingediendBedrag ?? calcBtwSaldo(boekingen);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-label-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {periodeLabel(kwartaal.periode)}
            </p>
            <p
              className="font-tabular font-bold"
              style={{ color: 'var(--foreground)', fontSize: '22px', lineHeight: '28px' }}
            >
              {formatEuro(toonBedrag)}
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: 'rgba(6,95,70,0.1)', border: '1px solid rgba(6,95,70,0.25)' }}
          >
            <CheckCircle size={13} style={{ color: '#065f46' }} strokeWidth={2.5} />
            <span className="text-label-sm font-semibold" style={{ color: '#065f46' }}>
              Ingediend
            </span>
          </div>
        </div>

        {kwartaal.ingediendOp && (
          <p className="text-label-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Ingediend op {formatDatum(kwartaal.ingediendOp)}
          </p>
        )}

        {/* Expand toggle */}
        {boekingen.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between mt-3 pt-3 text-label-sm transition-colors"
            style={{
              borderTop: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
            }}
            aria-expanded={expanded}
          >
            <span>{boekingen.length} boeking{boekingen.length !== 1 ? 'en' : ''}</span>
            {expanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
          </button>
        )}
      </div>

      {/* Expanded boekingen list */}
      {expanded && boekingen.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {boekingen.map((b, i) => (
            <div
              key={b.id}
              className="px-4 py-3 flex items-start justify-between gap-3"
              style={{
                borderBottom: i < boekingen.length - 1 ? '1px solid var(--border)' : undefined,
                background: 'var(--muted)',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-label-sm truncate font-semibold" style={{ color: 'var(--foreground)' }}>
                  {b.partij || '—'}
                </p>
                {b.omschrijving && (
                  <p className="text-label-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {b.omschrijving}
                  </p>
                )}
                <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {formatDatum(b.datum)} · {b.type}
                </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-label-md font-tabular font-bold" style={{ color: 'var(--foreground)' }}>
                  {formatEuro(b.bedragInclBtw)}
                </span>
                {b.btwBedrag != null && (
                  <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                    BTW {formatEuro(b.btwBedrag)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Openstaand Saldo Card ─────────────────────────────────────────────────

interface OpenstaandSaldoCardProps {
  openstaand: OpenstaandSaldo;
  onIndienen: () => void;
}

function OpenstaandSaldoCard({ openstaand, onIndienen }: OpenstaandSaldoCardProps) {
  const { berekendSaldo, totaleOmzetExclBtw, omzetPerTarief, btwAfTeDragen, btwTerugTeVragen } = openstaand;

  function tariefLabel(percentage: number | null): string {
    return percentage === null ? 'Overig tarief' : `${percentage}% BTW`;
  }

  return (
    <div
      className="rounded-2xl overflow-hidden mb-5"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      <div className="p-4">
        <p className="text-label-sm mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Te betalen / terug te vragen BTW
        </p>
        <p
          className="font-tabular font-bold mb-1"
          style={{ color: 'var(--foreground)', fontSize: '28px', lineHeight: '34px' }}
        >
          {formatEuro(berekendSaldo)}
        </p>
        <p className="text-label-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
          Over alles wat nog bij geen enkele ingediende aangifte hoort. Voeg je
          later nog een factuur toe (ook van een eerder kwartaal), dan telt die
          gewoon hier in mee totdat je indient.
        </p>

        {/* Uitsplitsing t.b.v. de BTW-aangifte */}
        <div className="rounded-xl mb-4" style={{ border: '1px solid var(--border)' }}>
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
              Omzet (excl. BTW)
            </span>
            <span className="text-label-md font-tabular font-semibold" style={{ color: 'var(--foreground)' }}>
              {formatEuro(totaleOmzetExclBtw)}
            </span>
          </div>
          {omzetPerTarief.map((t) => (
            <div
              key={t.percentage ?? 'overig'}
              className="flex items-center justify-between pl-6 pr-3 py-2"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}
            >
              <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                waarvan {tariefLabel(t.percentage)}
              </span>
              <span className="text-label-sm font-tabular" style={{ color: 'var(--muted-foreground)' }}>
                {formatEuro(t.omzetExclBtw)}
              </span>
            </div>
          ))}
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
              Te betalen BTW
            </span>
            <span className="text-label-md font-tabular font-semibold" style={{ color: 'var(--foreground)' }}>
              {formatEuro(btwAfTeDragen)}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
              Voorbelasting
            </span>
            <span className="text-label-md font-tabular font-semibold" style={{ color: 'var(--foreground)' }}>
              {formatEuro(btwTerugTeVragen)}
            </span>
          </div>
        </div>

        <button
          onClick={onIndienen}
          className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-label-md"
        >
          <CheckCircle size={16} strokeWidth={2} className="text-white" />
          Kwartaal indienen
        </button>
      </div>
    </div>
  );
}
// ─── Main Component ───────────────────────────────────────────────────────────

export default function BtwAangifteContent() {
  const { user } = useAuth();
  const [openstaand, setOpenstaand] = useState<OpenstaandSaldo>({ boekingen: [], totaleOmzetExclBtw: 0, omzetPerTarief: [], btwAfTeDragen: 0, btwTerugTeVragen: 0, berekendSaldo: 0 });
  const [kwartalen, setKwartalen] = useState<KwartaalMetBoekingen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIndienen, setShowIndienen] = useState(false);
  const [showHistorisch, setShowHistorisch] = useState(false);

  const loadData = async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [alleKwartalen, openstaandeBoekingen, alleBoekingen] = await Promise.all([
        btwService.getKwartalen(),
        btwService.getOpenstaandeBoekingen(),
        btwService.getBoekingenMetPeriode(),
      ]);
      setOpenstaand(btwService.berekenOpenstaandSaldo(openstaandeBoekingen));
      setKwartalen(btwService.buildKwartalenMetBoekingen(alleKwartalen, alleBoekingen));
    } catch (err) {
      console.error('BtwAangifteContent loadData error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleKwartaalUpdated = (_kwartaal: BtwKwartaal) => {
    // Boekingen zijn herverdeeld (openstaand → ingediend kwartaal), dus alles opnieuw ophalen.
    loadData();
    setShowIndienen(false);
    setShowHistorisch(false);
  };

  const handleHistorischSuccess = (_kwartaal: BtwKwartaal) => {
    loadData();
    setShowHistorisch(false);
  };

  return (
    <div className="px-5 max-w-lg mx-auto pt-2 pb-6">
      {/* Header card */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--primary)' }}
      >
        <p
          className="text-label-md mb-1 tracking-widest"
          style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em' }}
        >
          BTW-SALDO
        </p>
        <p className="text-body-md text-white">
          Doorlopend saldo van alle nog niet ingediende boekingen, plus je eerder
          ingediende kwartalen.
        </p>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 animate-pulse"
              style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
            >
              <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--input)' }} />
              <div className="h-7 rounded w-1/2 mb-3" style={{ background: 'var(--input)' }} />
              <div className="h-10 rounded-xl" style={{ background: 'var(--input)' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <OpenstaandSaldoCard openstaand={openstaand} onIndienen={() => setShowIndienen(true)} />

          {/* Add historical quarter button */}
          <button
            onClick={() => setShowHistorisch(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 mb-5 text-label-md font-semibold transition-colors"
            style={{
              border: '1px dashed var(--border)',
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Historisch kwartaal toevoegen
          </button>

          {kwartalen.length === 0 ? (
            <div
              className="card-base flex flex-col items-center justify-center py-14 px-6 text-center"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--muted)' }}
              >
                <FileText size={26} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p className="text-headline-sm mb-2" style={{ color: 'var(--foreground)' }}>
                Nog geen ingediende kwartalen
              </p>
              <p className="text-body-md max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                Dien het openstaande saldo hierboven in, of voeg een historisch kwartaal toe.
              </p>
            </div>
          ) : (
            kwartalen.map((k) => <PeriodeCard key={k.kwartaal.periode} item={k} />)
          )}
        </>
      )}

      {/* Indienen modal */}
      {showIndienen && (
        <IndienenModal
          openstaand={openstaand}
          onClose={() => setShowIndienen(false)}
          onSuccess={handleKwartaalUpdated}
        />
      )}

      {/* Historisch kwartaal modal */}
      {showHistorisch && (
        <HistorischModal
          onClose={() => setShowHistorisch(false)}
          onSuccess={handleHistorischSuccess}
        />
      )}
    </div>
  );
}
