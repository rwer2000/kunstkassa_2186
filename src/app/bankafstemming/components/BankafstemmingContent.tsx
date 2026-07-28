'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X, Search, Link2, Link2Off, Tag, AlertCircle, CheckCircle, FileText, RefreshCw, Clock } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { bankTransactiesService, BankTransactie, MatchStatus, NieuweTransactie } from '@/lib/services/bankTransactiesService';
import { boekingenService, Boeking } from '@/lib/services/boekingenService';
import { getProfiel } from '@/lib/services/profielService';
import { createClient } from '@/lib/supabase/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}€\u00a0${formatted}`;
}

function formatDatum(datum: string | null): string {
  if (!datum) return '—';
  const d = new Date(datum);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function periodeLabel(periode: string): string {
  const parts = periode.split('-');
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return periode;
}

function buildPeriodeOpties(): string[] {
  const now = new Date();
  const opties: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const q = Math.floor(d.getMonth() / 3) + 1;
    opties.push(`${d.getFullYear()}-Q${q}`);
  }
  return [...new Set(opties)];
}

function computeHash(datum: string, bedrag: string, omschrijving: string, iban: string): string {
  const raw = `${datum}|${bedrag}|${omschrijving}|${iban}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + raw.length.toString(36);
}

// Datum parsing: dd-mm-jjjj en jjjjmmdd
function parseDatum(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // dd-mm-jjjj
  const dmY = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  // jjjjmmdd
  const Ymd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (Ymd) return `${Ymd[1]}-${Ymd[2]}-${Ymd[3]}`;
  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseBedrag(raw: string, afBij?: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s/g, '');
  // Verwijder valutasymbolen
  s = s.replace(/[€$£]/g, '');
  // Komma als decimaalteken (NL-stijl): 1.234,56 → 1234.56
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const val = parseFloat(s);
  if (isNaN(val)) return null;
  // Af/Bij kolom
  if (afBij) {
    const ab = afBij.trim().toLowerCase();
    if (ab === 'af' || ab === 'debet' || ab === 'd') return -Math.abs(val);
    if (ab === 'bij' || ab === 'credit' || ab === 'c') return Math.abs(val);
  }
  return val;
}

function datumNaarPeriode(datum: string): string {
  const d = new Date(datum);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

// NL-bank header presets
const NL_BANK_PRESETS: Record<string, Record<string, string>> = {
  ING: {
    datum: 'Datum',
    bedrag: 'Bedrag (EUR)',
    omschrijving: 'Naam / Omschrijving',
    tegenpartijNaam: 'Naam / Omschrijving',
    tegenpartijIban: 'Tegenrekening IBAN',
    afBij: 'Af of Bij',
  },
  Rabobank: {
    datum: 'Datum',
    bedrag: 'Bedrag',
    omschrijving: 'Omschrijving',
    tegenpartijNaam: 'Naam tegenpartij',
    tegenpartijIban: 'Tegenrekening',
    afBij: 'Debet/Credit',
  },
  'ABN AMRO': {
    datum: 'Transactiedatum',
    bedrag: 'Bedrag',
    omschrijving: 'Omschrijving',
    tegenpartijNaam: 'Tegenpartij',
    tegenpartijIban: 'Tegenrekening',
    afBij: '',
  },
  Knab: {
    datum: 'Boekingsdatum',
    bedrag: 'Bedrag',
    omschrijving: 'Omschrijving',
    tegenpartijNaam: 'Tegenpartij naam',
    tegenpartijIban: 'Tegenpartij IBAN',
    afBij: '',
  },
  bunq: {
    datum: 'date',
    bedrag: 'amount',
    omschrijving: 'description',
    tegenpartijNaam: 'name',
    tegenpartijIban: 'iban',
    afBij: '',
  },
};

type KolomMapping = {
  datum: string;
  bedrag: string;
  omschrijving: string;
  tegenpartijNaam: string;
  tegenpartijIban: string;
  afBij: string;
};

const KOLOM_LABELS: Record<keyof KolomMapping, string> = {
  datum: 'Datum',
  bedrag: 'Bedrag',
  omschrijving: 'Omschrijving',
  tegenpartijNaam: 'Tegenpartij naam',
  tegenpartijIban: 'Tegenpartij IBAN',
  afBij: 'Af/Bij kolom (optioneel)',
};

// ─── Match Status Badge ───────────────────────────────────────────────────────

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const config: Record<MatchStatus, { label: string; cls: string }> = {
    nog_te_matchen: { label: 'Nog te matchen', cls: 'status-pending' },
    gematcht: { label: 'Gematcht', cls: 'status-verwerkt' },
    geen_factuur: { label: 'Geen factuur', cls: 'bg-blue-100 text-blue-700' },
    prive: { label: 'Privé', cls: 'bg-purple-100 text-purple-700' },
  };
  const { label, cls } = config[status];
  return (
    <span className={`inline-flex items-center rounded-full font-semibold tracking-wide whitespace-nowrap text-[10px] px-2 py-0.5 ${cls}`} style={{ letterSpacing: '0.04em' }}>
      {label}
    </span>
  );
}

// ─── Koppel Boeking Modal ─────────────────────────────────────────────────────

interface KoppelModalProps {
  transactie: BankTransactie;
  onClose: () => void;
  onGekoppeld: (transactie: BankTransactie) => void;
}

function KoppelModal({ transactie, onClose, onGekoppeld }: KoppelModalProps) {
  const [boekingen, setBoekingen] = useState<Boeking[]>([]);
  const [zoek, setZoek] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boekingenService.getBoekingen().then((data) => {
      setBoekingen(data);
      setIsLoading(false);
    });
  }, []);

  const gefilterd = boekingen.filter((b) => {
    if (!zoek) return true;
    const q = zoek.toLowerCase();
    return (
      (b.partij ?? '').toLowerCase().includes(q) ||
      (b.omschrijving ?? '').toLowerCase().includes(q) ||
      (b.datum ?? '').includes(q)
    );
  });

  const handleKoppel = async (boeking: Boeking) => {
    setIsSaving(true);
    setError(null);
    const ok = await bankTransactiesService.koppelBoeking(transactie.id, boeking.id);
    if (ok) {
      onGekoppeld({ ...transactie, matchStatus: 'gematcht', boekingId: boeking.id, boeking: { partij: boeking.partij, bedragInclBtw: boeking.bedragInclBtw, datum: boeking.datum } });
    } else {
      setError('Koppelen mislukt. Probeer opnieuw.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-t-2xl flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>Koppel aan boeking</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted" aria-label="Sluiten">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl px-3" style={{ border: '1px solid var(--border)', background: 'var(--input)' }}>
            <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Zoek op partij, omschrijving of datum..."
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              className="flex-1 py-2.5 bg-transparent text-body-md outline-none"
              style={{ color: 'var(--foreground)' }}
            />
          </div>
        </div>
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
            <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
            <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {isLoading ? (
            <p className="text-label-md py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>Laden...</p>
          ) : gefilterd.length === 0 ? (
            <p className="text-label-md py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>Geen boekingen gevonden.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {gefilterd.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleKoppel(b)}
                  disabled={isSaving}
                  className="w-full text-left rounded-xl px-4 py-3 transition-colors hover:bg-muted disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-label-md font-semibold truncate" style={{ color: 'var(--foreground)' }}>{b.partij ?? '—'}</p>
                      <p className="text-label-sm truncate" style={{ color: 'var(--muted-foreground)' }}>{b.omschrijving ?? '—'} · {formatDatum(b.datum)}</p>
                    </div>
                    <span className="text-label-md font-semibold flex-shrink-0" style={{ color: 'var(--foreground)' }}>{formatEuro(b.bedragInclBtw)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Markeer Modal ────────────────────────────────────────────────────────────

interface MarkeerModalProps {
  transactie: BankTransactie;
  onClose: () => void;
  onGemarkeerd: (transactie: BankTransactie) => void;
}

function MarkeerModal({ transactie, onClose, onGemarkeerd }: MarkeerModalProps) {
  const [status, setStatus] = useState<'prive' | 'geen_factuur'>('geen_factuur');
  const [toelichting, setToelichting] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpslaan = async () => {
    setIsSaving(true);
    setError(null);
    const ok = await bankTransactiesService.markeerStatus(transactie.id, status, toelichting || undefined);
    if (ok) {
      onGemarkeerd({ ...transactie, matchStatus: status, matchToelichting: toelichting || null, boekingId: null });
    } else {
      setError('Opslaan mislukt. Probeer opnieuw.');
      setIsSaving(false);
    }
  };

  const fieldStyle = { border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)' };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-t-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>Markeren als</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted" aria-label="Sluiten">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          {(['geen_factuur', 'prive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2.5 rounded-xl text-label-md font-semibold transition-colors ${status === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s === 'geen_factuur' ? 'Geen factuur' : 'Privé'}
            </button>
          ))}
        </div>
        <label className="text-label-sm block mb-1" style={{ color: 'var(--muted-foreground)' }}>Toelichting (optioneel)</label>
        <textarea
          value={toelichting}
          onChange={(e) => setToelichting(e.target.value)}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-body-md outline-none resize-none mb-4"
          style={fieldStyle}
          placeholder="Bijv. privé aankoop, geen BTW..."
        />
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
            <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
            <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={isSaving} className="flex-1 btn-secondary py-3 disabled:opacity-60">Annuleren</button>
          <button onClick={handleOpslaan} disabled={isSaving} className="flex-1 btn-primary py-3 disabled:opacity-60">
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Import Flow ──────────────────────────────────────────────────────────

interface ParsedRij {
  boekdatum: string;
  bedrag: number;
  tegenpartijNaam: string;
  tegenpartijIban: string;
  omschrijving: string;
  importHash: string;
}

interface ImportFlowProps {
  onClose: () => void;
  onImported: (periode: string) => void;
}

function ImportFlow({ onClose, onImported }: ImportFlowProps) {
  const periodeOpties = buildPeriodeOpties();
  const [importType, setImportType] = useState<'csv' | 'pdf'>('csv');
  const [stap, setStap] = useState<'kies' | 'mapping' | 'preview' | 'bezig' | 'klaar'>('kies');
  const [periode, setPeriode] = useState(periodeOpties[0]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<KolomMapping>({ datum: '', bedrag: '', omschrijving: '', tegenpartijNaam: '', tegenpartijIban: '', afBij: '' });
  const [parsedRijen, setParsedRijen] = useState<ParsedRij[]>([]);
  const [duplicaten, setDuplicaten] = useState(0);
  const [resultaat, setResultaat] = useState<{ ingevoegd: number; overgeslagen: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const detecteerBank = useCallback((hdrs: string[]) => {
    for (const [bank, preset] of Object.entries(NL_BANK_PRESETS)) {
      const score = Object.values(preset).filter((v) => v && hdrs.includes(v)).length;
      if (score >= 3) return preset;
    }
    // Slimme voorzet op basis van veelvoorkomende namen
    const voorzet: KolomMapping = { datum: '', bedrag: '', omschrijving: '', tegenpartijNaam: '', tegenpartijIban: '', afBij: '' };
    for (const h of hdrs) {
      const hl = h.toLowerCase();
      if (!voorzet.datum && (hl.includes('datum') || hl === 'date')) voorzet.datum = h;
      if (!voorzet.bedrag && (hl.includes('bedrag') || hl === 'amount' || hl.includes('amount'))) voorzet.bedrag = h;
      if (!voorzet.omschrijving && (hl.includes('omschrijving') || hl.includes('description') || hl.includes('memo'))) voorzet.omschrijving = h;
      if (!voorzet.tegenpartijNaam && (hl.includes('naam') || hl.includes('name') || hl.includes('tegenpartij'))) voorzet.tegenpartijNaam = h;
      if (!voorzet.tegenpartijIban && (hl.includes('iban') || hl.includes('rekening'))) voorzet.tegenpartijIban = h;
      if (!voorzet.afBij && (hl.includes('af of bij') || hl.includes('debet') || hl.includes('credit') || hl === 'dc')) voorzet.afBij = h;
    }
    return voorzet;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Detecteer scheidingsteken
      const firstLine = text.split('\n')[0];
      const sep = firstLine.includes(';') ? ';' : ',';
      const lines = text.split('\n').filter((l) => l.trim());
      const hdrs = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, '').trim());
      const dataRows = lines.slice(1).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
      setHeaders(hdrs);
      setRows(dataRows);
      const voorzet = detecteerBank(hdrs);
      setMapping({ datum: voorzet.datum || '', bedrag: voorzet.bedrag || '', omschrijving: voorzet.omschrijving || '', tegenpartijNaam: voorzet.tegenpartijNaam || '', tegenpartijIban: voorzet.tegenpartijIban || '', afBij: voorzet.afBij || '' });
      setStap('mapping');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setError(null);
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) { setError('Kies eerst een PDF-bestand.'); return; }
    setStap('bezig');
    setError(null);
    const ok = await bankTransactiesService.uploadPdfAfschrift(pdfFile, periode);
    if (ok) {
      setStap('klaar');
    } else {
      setError('Uploaden mislukt. Probeer opnieuw.');
      setStap('kies');
    }
  };

  const handleMappingBevestig = () => {
    if (!mapping.datum || !mapping.bedrag) {
      setError('Selecteer minimaal de kolommen Datum en Bedrag.');
      return;
    }
    setError(null);

    const datumIdx = headers.indexOf(mapping.datum);
    const bedragIdx = headers.indexOf(mapping.bedrag);
    const omschrijvingIdx = mapping.omschrijving ? headers.indexOf(mapping.omschrijving) : -1;
    const naamIdx = mapping.tegenpartijNaam ? headers.indexOf(mapping.tegenpartijNaam) : -1;
    const ibanIdx = mapping.tegenpartijIban ? headers.indexOf(mapping.tegenpartijIban) : -1;
    const afBijIdx = mapping.afBij ? headers.indexOf(mapping.afBij) : -1;

    const parsed: ParsedRij[] = [];
    for (const row of rows) {
      const datumRaw = row[datumIdx] ?? '';
      const bedragRaw = row[bedragIdx] ?? '';
      const afBijRaw = afBijIdx >= 0 ? (row[afBijIdx] ?? '') : '';
      const datum = parseDatum(datumRaw);
      const bedrag = parseBedrag(bedragRaw, afBijRaw || undefined);
      if (!datum || bedrag === null) continue;
      const omschrijving = omschrijvingIdx >= 0 ? (row[omschrijvingIdx] ?? '') : '';
      const naam = naamIdx >= 0 ? (row[naamIdx] ?? '') : '';
      const iban = ibanIdx >= 0 ? (row[ibanIdx] ?? '') : '';
      let hash = computeHash(datum, bedrag.toString(), omschrijving, iban);
      parsed.push({ boekdatum: datum, bedrag, tegenpartijNaam: naam, tegenpartijIban: iban, omschrijving, importHash: hash });
    }

    // Bereken duplicaten op basis van hashes
    const hashSet = new Set<string>();
    let dups = 0;
    const uniek: ParsedRij[] = [];
    for (const r of parsed) {
      if (hashSet.has(r.importHash)) { dups++; continue; }
      hashSet.add(r.importHash);
      uniek.push(r);
    }
    setDuplicaten(dups);
    setParsedRijen(uniek);
    setStap('preview');
  };

  const handleImport = async () => {
    setStap('bezig');
    setError(null);
    try {
      const nieuweTransacties: NieuweTransactie[] = parsedRijen.map((r) => ({
        boekdatum: r.boekdatum,
        bedrag: r.bedrag,
        tegenpartijNaam: r.tegenpartijNaam || undefined,
        tegenpartijIban: r.tegenpartijIban || undefined,
        omschrijving: r.omschrijving || undefined,
        periode,
        importHash: r.importHash,
      }));

      const res = await bankTransactiesService.importTransacties(nieuweTransacties);

      // Upload CSV naar documents bucket
      if (csvFile) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const timestamp = Date.now();
          const sanitized = csvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${user.id}/${timestamp}_${sanitized}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, csvFile, { cacheControl: '3600', upsert: false });
          if (!uploadErr) {
            await supabase.from('documents').insert({
              user_id: user.id,
              file_name: csvFile.name,
              file_path: filePath,
              file_size: csvFile.size,
              mime_type: 'text/csv',
              bucket_name: 'documents',
              doc_status: 'verwerkt',
              bron: 'bankexport',
            });
          }
        }
      }

      setResultaat({ ingevoegd: res.ingevoegd, overgeslagen: res.overgeslagen + duplicaten });
      setStap('klaar');
    } catch (err: any) {
      setError(err?.message || 'Import mislukt.');
      setStap('preview');
    }
  };

  const selectClass = "w-full px-3 py-2.5 rounded-xl text-label-md outline-none appearance-none cursor-pointer";
  const selectStyle = { background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-t-2xl flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {stap === 'kies' && 'Afschrift importeren'}
            {stap === 'mapping' && 'Kolommen koppelen'}
            {stap === 'preview' && 'Voorbeeld & bevestigen'}
            {stap === 'bezig' && (importType === 'pdf' ? 'Uploaden...' : 'Importeren...')}
            {stap === 'klaar' && (importType === 'pdf' ? 'Afschrift geüpload' : 'Import voltooid')}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted" aria-label="Sluiten">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5">
          {/* Stap 1: Kies type, kwartaal + bestand */}
          {stap === 'kies' && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                {(['csv', 'pdf'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setImportType(t); setError(null); }}
                    className={`flex-1 py-2.5 rounded-xl text-label-md font-semibold transition-colors ${importType === t ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t === 'csv' ? 'CSV' : 'PDF-afschrift'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-label-sm block mb-1" style={{ color: 'var(--muted-foreground)' }}>Kwartaal</label>
                <select value={periode} onChange={(e) => setPeriode(e.target.value)} className={selectClass} style={selectStyle}>
                  {periodeOpties.map((p) => <option key={p} value={p}>{periodeLabel(p)}</option>)}
                </select>
              </div>
              {importType === 'csv' ? (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 px-4 py-8 rounded-xl transition-colors"
                    style={{ border: '2px dashed var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                  >
                    <Upload size={28} strokeWidth={1.5} />
                    <span className="text-label-md">Klik om een CSV-bestand te kiezen</span>
                    <span className="text-label-sm">Ondersteund: ING, Rabobank, ABN AMRO, Knab, bunq</span>
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </>
              ) : (
                <>
                  <button
                    onClick={() => pdfFileRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 px-4 py-8 rounded-xl transition-colors"
                    style={{ border: '2px dashed var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                  >
                    <Upload size={28} strokeWidth={1.5} />
                    <span className="text-label-md">
                      {pdfFile ? pdfFile.name : 'Klik om een PDF-afschrift te kiezen'}
                    </span>
                    <span className="text-label-sm">Voor banken zonder CSV-export, zoals Rabobank zakelijk</span>
                  </button>
                  <input ref={pdfFileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfFileChange} />
                  <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Er wordt niets automatisch uitgelezen — het afschrift wordt verwerkt bij de eerstvolgende Claude-sessie.
                  </p>
                </>
              )}
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
                  <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Stap 2: Kolom mapping */}
          {stap === 'mapping' && (
            <div className="flex flex-col gap-4">
              <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>
                Wijs de kolommen uit jouw CSV toe. We hebben een voorzet gedaan op basis van veelgebruikte bankformaten.
              </p>
              {(Object.keys(KOLOM_LABELS) as (keyof KolomMapping)[]).map((veld) => (
                <div key={veld}>
                  <label className="text-label-sm block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    {KOLOM_LABELS[veld]}{veld !== 'afBij' && veld !== 'tegenpartijNaam' && veld !== 'tegenpartijIban' && veld !== 'omschrijving' ? ' *' : ''}
                  </label>
                  <select
                    value={mapping[veld]}
                    onChange={(e) => setMapping((m) => ({ ...m, [veld]: e.target.value }))}
                    className={selectClass}
                    style={selectStyle}
                  >
                    <option value="">— Niet gebruiken —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
                  <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Stap 3: Preview */}
          {stap === 'preview' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: 'var(--muted)' }}>
                <p className="text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>
                  {parsedRijen.length} transacties klaar voor import
                </p>
                {duplicaten > 0 && (
                  <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {duplicaten} rij{duplicaten !== 1 ? 'en' : ''} overgeslagen als duplicaat (zelfde datum/bedrag/omschrijving/IBAN).
                  </p>
                )}
                <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Kwartaal: {periodeLabel(periode)}</p>
              </div>
              {/* Preview tabel */}
              <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-label-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Datum</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>Tegenpartij</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: 'var(--muted-foreground)' }}>Bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRijen.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{formatDatum(r.boekdatum)}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate" style={{ color: 'var(--foreground)' }}>{r.tegenpartijNaam || r.omschrijving || '—'}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${r.bedrag < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEuro(r.bedrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRijen.length > 10 && (
                  <p className="px-3 py-2 text-label-sm" style={{ color: 'var(--muted-foreground)' }}>... en nog {parsedRijen.length - 10} meer</p>
                )}
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#ba1a1a' }} />
                  <span className="text-label-sm" style={{ color: '#ba1a1a' }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Stap: bezig */}
          {stap === 'bezig' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>Transacties worden geïmporteerd...</p>
            </div>
          )}

          {/* Stap: klaar */}
          {stap === 'klaar' && importType === 'pdf' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle size={40} style={{ color: 'var(--primary)' }} />
              <p className="text-headline-sm font-semibold text-center" style={{ color: 'var(--foreground)' }}>Afschrift geüpload</p>
              <div className="rounded-xl px-6 py-4 w-full" style={{ background: 'var(--muted)' }}>
                <p className="text-label-md" style={{ color: 'var(--foreground)' }}>{pdfFile?.name}</p>
                <p className="text-label-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Wordt verwerkt bij de eerstvolgende Claude-sessie. Geen verdere actie nodig.
                </p>
              </div>
            </div>
          )}
          {stap === 'klaar' && importType === 'csv' && resultaat && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle size={40} style={{ color: 'var(--primary)' }} />
              <p className="text-headline-sm font-semibold text-center" style={{ color: 'var(--foreground)' }}>Import geslaagd!</p>
              <div className="rounded-xl px-6 py-4 w-full" style={{ background: 'var(--muted)' }}>
                <p className="text-label-md" style={{ color: 'var(--foreground)' }}>✅ {resultaat.ingevoegd} transacties geïmporteerd</p>
                {resultaat.overgeslagen > 0 && (
                  <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>⏭ {resultaat.overgeslagen} overgeslagen (duplicaten)</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer knoppen */}
        <div className="px-5 pb-6 pt-4 flex-shrink-0 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          {stap === 'kies' && importType === 'csv' && (
            <button onClick={onClose} className="flex-1 btn-secondary py-3">Annuleren</button>
          )}
          {stap === 'kies' && importType === 'pdf' && (
            <>
              <button onClick={onClose} className="flex-1 btn-secondary py-3">Annuleren</button>
              <button onClick={handlePdfUpload} disabled={!pdfFile} className="flex-1 btn-primary py-3 disabled:opacity-60">Uploaden</button>
            </>
          )}
          {stap === 'mapping' && (
            <>
              <button onClick={() => setStap('kies')} className="flex-1 btn-secondary py-3">Terug</button>
              <button onClick={handleMappingBevestig} className="flex-1 btn-primary py-3">Volgende</button>
            </>
          )}
          {stap === 'preview' && (
            <>
              <button onClick={() => setStap('mapping')} className="flex-1 btn-secondary py-3">Terug</button>
              <button onClick={handleImport} disabled={parsedRijen.length === 0} className="flex-1 btn-primary py-3 disabled:opacity-60">
                Importeren ({parsedRijen.length})
              </button>
            </>
          )}
          {stap === 'klaar' && (
            <button onClick={() => { onImported(periode); onClose(); }} className="flex-1 btn-primary py-3">Sluiten</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────

type ActiveModal = { type: 'koppel'; transactie: BankTransactie } | { type: 'markeer'; transactie: BankTransactie } | null;

export default function BankafstemmingContent() {
  const { user } = useAuth();
  const periodeOpties = buildPeriodeOpties();
  const [periode, setPeriode] = useState(periodeOpties[0]);
  const [transacties, setTransacties] = useState<BankTransactie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'alle'>('alle');
  const [showImport, setShowImport] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [wachtendAfschrift, setWachtendAfschrift] = useState<{ fileName: string; createdAt: string } | null>(null);
  const [heeftZakelijkeRekening, setHeeftZakelijkeRekening] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getProfiel(user.id).then((p) => setHeeftZakelijkeRekening(p?.heeftZakelijkeRekening ?? false));
  }, [user?.id]);

  const laadTransacties = useCallback(async (p: string) => {
    setIsLoading(true);
    const [data, afschrift] = await Promise.all([
      bankTransactiesService.getTransacties(p),
      bankTransactiesService.getWachtendAfschrift(p),
    ]);
    setTransacties(data);
    setWachtendAfschrift(afschrift);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) laadTransacties(periode);
  }, [user, periode, laadTransacties]);

  const handleOntkoppel = async (transactie: BankTransactie) => {
    const ok = await bankTransactiesService.ontkoppel(transactie.id);
    if (ok) {
      setTransacties((prev) => prev.map((t) => t.id === transactie.id ? { ...t, matchStatus: 'nog_te_matchen', boekingId: null, matchToelichting: null, boeking: null } : t));
    }
  };

  const handleTransactieUpdate = (updated: BankTransactie) => {
    setTransacties((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setActiveModal(null);
  };

  const gefilterd = transacties.filter((t) => statusFilter === 'alle' || t.matchStatus === statusFilter);

  // Samenvatting
  const totaal = transacties.length;
  const gematcht = transacties.filter((t) => t.matchStatus === 'gematcht').length;
  const ongematchBedrag = transacties.filter((t) => t.matchStatus === 'nog_te_matchen').reduce((s, t) => s + t.bedrag, 0);

  const statusFilters: { key: MatchStatus | 'alle'; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'nog_te_matchen', label: 'Nog te matchen' },
    { key: 'gematcht', label: 'Gematcht' },
    { key: 'geen_factuur', label: 'Geen factuur' },
    { key: 'prive', label: 'Privé' },
  ];

  const selectClass = "px-3 py-2.5 rounded-xl text-label-md outline-none appearance-none cursor-pointer";
  const selectStyle = { background: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)' };

  if (heeftZakelijkeRekening === false) {
    return (
      <AppLayout>
        <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-3 rounded-2xl p-8 mt-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <FileText size={40} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>Niet van toepassing</p>
            <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>
              Bankafstemming is alleen relevant als je een zakelijke bankrekening hebt. Zet dit aan bij
              Instellingen als dat wel het geval is.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">
        {/* Paginatitel + import knop */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-headline-md font-bold" style={{ color: 'var(--foreground)' }}>Bankafstemming</h1>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 btn-primary px-4 py-2 text-label-md"
          >
            <Upload size={16} strokeWidth={2} />
            Afschrift importeren
          </button>
        </div>

        {/* Kwartaalfilter */}
        <div className="mb-4">
          <select value={periode} onChange={(e) => { setPeriode(e.target.value); setStatusFilter('alle'); }} className={`${selectClass} w-full`} style={selectStyle}>
            {periodeOpties.map((p) => <option key={p} value={p}>{periodeLabel(p)}</option>)}
          </select>
        </div>

        {/* Banner: wachtend PDF-afschrift */}
        {wachtendAfschrift && (
          <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <Clock size={18} style={{ color: '#f59e0b' }} className="flex-shrink-0 mt-0.5" />
            <p className="text-label-md" style={{ color: 'var(--foreground)' }}>
              Afschrift <span className="font-semibold">{wachtendAfschrift.fileName}</span> wacht nog op verwerking.
            </p>
          </div>
        )}

        {/* Samenvattingskaart */}
        <div className="rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-center">
            <p className="text-headline-sm font-bold" style={{ color: 'var(--foreground)' }}>{gematcht}/{totaal}</p>
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Gematcht</p>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
            <p className="text-headline-sm font-bold" style={{ color: 'var(--foreground)' }}>{totaal - gematcht}</p>
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Openstaand</p>
          </div>
          <div className="text-center">
            <p className={`text-headline-sm font-bold ${ongematchBedrag < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEuro(ongematchBedrag)}</p>
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Ongematch</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {statusFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-label-sm font-semibold transition-all ${statusFilter === key ? 'bottom-nav-pill text-white' : ''}`}
              style={statusFilter !== key ? { background: 'var(--muted)', color: 'var(--muted-foreground)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Transacties lijst */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : gefilterd.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <FileText size={40} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-label-md text-center" style={{ color: 'var(--muted-foreground)' }}>
              {transacties.length === 0 ? 'Nog geen transacties voor dit kwartaal. Importeer een CSV om te beginnen.' : 'Geen transacties voor dit filter.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {gefilterd.map((t) => (
              <div key={t.id} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                {/* Rij 1: datum + bedrag */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {t.tegenpartijNaam || '—'}
                    </p>
                    <p className="text-label-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {formatDatum(t.boekdatum)} {t.tegenpartijIban ? `· ${t.tegenpartijIban}` : ''}
                    </p>
                    {t.omschrijving && (
                      <p className="text-label-sm truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{t.omschrijving}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-label-md font-bold ${t.bedrag < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEuro(t.bedrag)}</p>
                    <div className="mt-1"><MatchStatusBadge status={t.matchStatus} /></div>
                  </div>
                </div>

                {/* Gekoppelde boeking info */}
                {t.matchStatus === 'gematcht' && t.boeking && (
                  <div className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2" style={{ background: 'var(--muted)' }}>
                    <Link2 size={14} style={{ color: 'var(--muted-foreground)' }} />
                    <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t.boeking.partij ?? '—'} · {formatEuro(t.boeking.bedragInclBtw)} · {formatDatum(t.boeking.datum)}
                    </span>
                  </div>
                )}

                {/* Toelichting */}
                {t.matchToelichting && (
                  <p className="text-label-sm mb-2 italic" style={{ color: 'var(--muted-foreground)' }}>{t.matchToelichting}</p>
                )}

                {/* Acties */}
                <div className="flex gap-2 flex-wrap mt-1">
                  {t.matchStatus === 'nog_te_matchen' && (
                    <>
                      <button
                        onClick={() => setActiveModal({ type: 'koppel', transactie: t })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-colors btn-secondary"
                      >
                        <Link2 size={13} strokeWidth={2} />
                        Koppelen
                      </button>
                      <button
                        onClick={() => setActiveModal({ type: 'markeer', transactie: t })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-colors btn-secondary"
                      >
                        <Tag size={13} strokeWidth={2} />
                        Markeren
                      </button>
                    </>
                  )}
                  {(t.matchStatus === 'gematcht' || t.matchStatus === 'geen_factuur' || t.matchStatus === 'prive') && (
                    <button
                      onClick={() => handleOntkoppel(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-colors btn-secondary"
                    >
                      <Link2Off size={13} strokeWidth={2} />
                      Ontkoppelen
                    </button>
                  )}
                  {(t.matchStatus === 'geen_factuur' || t.matchStatus === 'prive') && (
                    <button
                      onClick={() => setActiveModal({ type: 'markeer', transactie: t })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-colors btn-secondary"
                    >
                      <Tag size={13} strokeWidth={2} />
                      Wijzigen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showImport && (
        <ImportFlow
          onClose={() => setShowImport(false)}
          onImported={(p) => { setPeriode(p); laadTransacties(p); }}
        />
      )}
      {activeModal?.type === 'koppel' && (
        <KoppelModal
          transactie={activeModal.transactie}
          onClose={() => setActiveModal(null)}
          onGekoppeld={handleTransactieUpdate}
        />
      )}
      {activeModal?.type === 'markeer' && (
        <MarkeerModal
          transactie={activeModal.transactie}
          onClose={() => setActiveModal(null)}
          onGemarkeerd={handleTransactieUpdate}
        />
      )}
    </AppLayout>
  );
}
