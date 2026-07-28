'use client';

import React, { useState } from 'react';
import { Camera, Image, TrendingUp, TrendingDown, ChevronRight, Trash2, X, FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AppImage from '@/components/ui/AppImage';
import PeriodFilter, { defaultPeriodFilter, isInPeriodFilter, PeriodFilterValue } from '@/components/PeriodFilter';
import { UploadedDocument } from '@/lib/services/documentService';
import { documentService } from '@/lib/services/documentService';
import { boekingenService, Boeking, NieuweBoeking } from '@/lib/services/boekingenService';
import { toast } from 'sonner';

interface DashboardDataProps {
  documents: UploadedDocument[];
  allDocuments: UploadedDocument[];
  boekingen: Boeking[];
  isLoading: boolean;
  isUploading: boolean;
  statusFilter: 'alle' | 'nog_te_verwerken' | 'verwerkt';
  onStatusFilterChange: (filter: 'alle' | 'nog_te_verwerken' | 'verwerkt') => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocumentDeleted: (docId: string) => void;
  onBoekingCreated: (boeking: Boeking) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '—';
  return `€\u00a0${amount.toFixed(2).replace('.', ',')}`;
}

function formatTotalAmount(amount: number): string {
  return `€\u00a0${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isPdf(doc: UploadedDocument): boolean {
  return doc.mimeType === 'application/pdf';
}

// ─── Boeking Modal ────────────────────────────────────────────────────────────
interface BoekingModalProps {
  doc: UploadedDocument;
  onClose: () => void;
  onSaved: (boeking: Boeking) => void;
}

function BoekingModal({ doc, onClose, onSaved }: BoekingModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [datum, setDatum] = useState(today);
  const [type, setType] = useState<'Inkoop' | 'Verkoop' | 'Overig'>('Inkoop');
  const [partij, setPartij] = useState('');
  const [omschrijving, setOmschrijving] = useState(doc.fileName.replace(/\.[^.]+$/, ''));
  const [bedragInclBtw, setBedragInclBtw] = useState('');
  const [btwPercentage, setBtwPercentage] = useState('21');
  const [isSaving, setIsSaving] = useState(false);

  const bedragNum = parseFloat(bedragInclBtw.replace(',', '.')) || 0;
  const btwPct = parseFloat(btwPercentage) || 0;
  const btwBedrag = btwPct > 0 ? parseFloat((bedragNum - bedragNum / (1 + btwPct / 100)).toFixed(2)) : 0;
  const bedragExcl = parseFloat((bedragNum - btwBedrag).toFixed(2));

  const handleSave = async () => {
    if (!bedragNum || bedragNum <= 0) {
      toast.error('Voer een geldig bedrag in');
      return;
    }
    setIsSaving(true);
    try {
      const nieuw: NieuweBoeking = {
        datum,
        type,
        partij: partij || undefined,
        omschrijving: omschrijving || undefined,
        bedragExclBtw: bedragExcl,
        btwPercentage: btwPct || undefined,
        btwBedrag: btwBedrag || undefined,
        bedragInclBtw: bedragNum,
        brondocumentId: doc.id,
      };
      const boeking = await boekingenService.createBoeking(nieuw);
      if (boeking) {
        toast.success('Boeking aangemaakt', { description: `${formatAmount(bedragNum)} is verwerkt.` });
        onSaved(boeking);
        onClose();
      }
    } catch (err: any) {
      toast.error('Opslaan mislukt', { description: err?.message || 'Probeer het opnieuw.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Verwerk als boeking
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <X size={18} style={{ color: 'var(--foreground)' }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Datum */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Datum</label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Type</label>
            <div className="flex gap-2">
              {(['Inkoop', 'Verkoop', 'Overig'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 text-label-sm font-semibold rounded-xl border transition-all ${
                    type === t ? 'text-white' : ''
                  }`}
                  style={{
                    background: type === t ? 'var(--primary)' : 'var(--input)',
                    borderColor: type === t ? 'var(--primary)' : 'var(--border)',
                    color: type === t ? 'white' : 'var(--foreground)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Partij */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Partij (leverancier/klant)</label>
            <input
              type="text"
              value={partij}
              onChange={(e) => setPartij(e.target.value)}
              placeholder="Bijv. Albert Heijn"
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Omschrijving */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Omschrijving</label>
            <input
              type="text"
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Bedrag incl. BTW */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Bedrag incl. BTW (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={bedragInclBtw}
              onChange={(e) => setBedragInclBtw(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 rounded-xl text-label-md border focus:outline-none focus:ring-2"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* BTW percentage */}
          <div>
            <label className="text-label-sm mb-1 block" style={{ color: 'var(--muted-foreground)' }}>BTW %</label>
            <div className="flex gap-2">
              {['0', '9', '21'].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setBtwPercentage(pct)}
                  className="flex-1 py-2 text-label-sm font-semibold rounded-xl border transition-all"
                  style={{
                    background: btwPercentage === pct ? 'var(--primary)' : 'var(--input)',
                    borderColor: btwPercentage === pct ? 'var(--primary)' : 'var(--border)',
                    color: btwPercentage === pct ? 'white' : 'var(--foreground)',
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Calculated summary */}
          {bedragNum > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--muted)' }}>
              <div className="flex justify-between text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                <span>Excl. BTW</span>
                <span>{formatAmount(bedragExcl)}</span>
              </div>
              <div className="flex justify-between text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                <span>BTW ({btwPercentage}%)</span>
                <span>{formatAmount(btwBedrag)}</span>
              </div>
              <div className="flex justify-between text-label-md font-semibold" style={{ color: 'var(--foreground)' }}>
                <span>Incl. BTW</span>
                <span>{formatAmount(bedragNum)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 btn-secondary py-3 disabled:opacity-60"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !bedragNum}
            className="flex-1 btn-primary py-3 disabled:opacity-60"
          >
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────
interface DetailModalProps {
  doc: UploadedDocument;
  onClose: () => void;
  onDelete: () => void;
  onBoekingCreated: (boeking: Boeking) => void;
}

function DetailModal({ doc, onClose, onDelete, onBoekingCreated }: DetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBoekingModal, setShowBoekingModal] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await documentService.deleteDocument(doc.id, doc.filePath);
      toast.success('Bestand verwijderd');
      onDelete();
      onClose();
    } catch (err: any) {
      toast.error('Verwijderen mislukt', { description: err?.message || 'Probeer het opnieuw.' });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex flex-col"
        style={{ background: 'var(--background)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Sluiten"
          >
            <X size={20} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
          </button>
          <h2 className="text-label-md font-semibold truncate max-w-[60%] text-center" style={{ color: 'var(--foreground)' }}>
            {doc.fileName}
          </h2>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
            aria-label="Verwijderen"
          >
            <Trash2 size={20} strokeWidth={2} style={{ color: 'var(--error, #ba1a1a)' }} />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4">
          {isPdf(doc) ? (
            doc.publicUrl ? (
              <iframe
                src={doc.publicUrl}
                title={doc.fileName}
                className="w-full rounded-xl border"
                style={{ height: '60vh', borderColor: 'var(--border)' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--muted)' }}
                >
                  <FileText size={40} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>
                  PDF-preview niet beschikbaar
                </p>
              </div>
            )
          ) : doc.publicUrl ? (
            <div className="w-full max-w-md">
              <AppImage
                src={doc.publicUrl}
                alt={`Volledige preview van ${doc.fileName}`}
                width={600}
                height={800}
                className="w-full rounded-xl object-contain"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--muted)' }}
              >
                <FileText size={40} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>
                Preview niet beschikbaar
              </p>
            </div>
          )}
        </div>

        {/* Metadata footer */}
        <div
          className="px-5 py-4 border-t flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Bestandsnaam</span>
              <span className="text-label-sm font-medium truncate max-w-[60%] text-right" style={{ color: 'var(--foreground)' }}>
                {doc.fileName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Uploaddatum</span>
              <span className="text-label-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {formatDate(doc.createdAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Status</span>
              <StatusBadge status={doc.docStatus} size="sm" />
            </div>
            {doc.publicUrl && isPdf(doc) && (
              <a
                href={doc.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full flex items-center justify-center gap-2 px-4 py-3 mt-2"
              >
                <FileText size={16} strokeWidth={2} />
                <span>Open bestand</span>
              </a>
            )}
            {/* Verwerk als boeking button — only for unprocessed docs */}
            {doc.docStatus === 'nog_te_verwerken' && (
              <button
                onClick={() => setShowBoekingModal(true)}
                className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 mt-2"
              >
                <Plus size={16} strokeWidth={2} />
                <span>Verwerk als boeking</span>
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation overlay */}
        {confirmDelete && (
          <div className="absolute inset-0 z-60 flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <h3 className="text-headline-sm mb-2" style={{ color: 'var(--foreground)' }}>
                Bestand verwijderen?
              </h3>
              <p className="text-body-md mb-5" style={{ color: 'var(--muted-foreground)' }}>
                Weet je zeker dat je dit bestand wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 btn-secondary py-3 disabled:opacity-60"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--error, #ba1a1a)' }}
                >
                  {isDeleting ? 'Verwijderen...' : 'Verwijderen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Boeking modal rendered outside the detail modal */}
      {showBoekingModal && (
        <BoekingModal
          doc={doc}
          onClose={() => setShowBoekingModal(false)}
          onSaved={(boeking) => {
            onBoekingCreated(boeking);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardData({
  documents,
  allDocuments,
  boekingen,
  isLoading,
  isUploading,
  statusFilter,
  onStatusFilterChange,
  onCamera,
  onGallery,
  onDocumentDeleted,
  onBoekingCreated,
}: DashboardDataProps) {
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<UploadedDocument | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>(defaultPeriodFilter());

  // Calculate totals from boekingen filtered by period
  const filteredBoekingen = boekingen.filter((b) => isInPeriodFilter(b.datum, periodFilter));
  const { thisMonthTotal, prevMonthTotal } = boekingenService.calcMaandTotalen(boekingen);
  const totalPeriodBoekingen = filteredBoekingen.reduce((sum, b) => sum + b.bedragInclBtw, 0);
  const hasBoekingen = boekingen.length > 0;
  const percentChange = prevMonthTotal > 0
    ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100)
    : null;
  const isPositive = percentChange !== null && percentChange >= 0;

  const handleInlineDelete = async () => {
    if (!confirmDeleteDoc) return;
    setDeletingId(confirmDeleteDoc.id);
    try {
      await documentService.deleteDocument(confirmDeleteDoc.id, confirmDeleteDoc.filePath);
      toast.success('Bestand verwijderd');
      onDocumentDeleted(confirmDeleteDoc.id);
    } catch (err: any) {
      toast.error('Verwijderen mislukt', { description: err?.message || 'Probeer het opnieuw.' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteDoc(null);
    }
  };

  const statusFilters: { key: 'alle' | 'nog_te_verwerken' | 'verwerkt'; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'nog_te_verwerken', label: 'Nog te verwerken' },
    { key: 'verwerkt', label: 'Verwerkt' },
  ];

  return (
    <div className="px-5 max-w-lg mx-auto">
      {/* Summary card */}
      <div className="card-base p-5 mb-4 mt-2">
        <p className="text-label-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
          Totaal deze periode
        </p>
        <p className="text-display-lg font-tabular mb-2" style={{ color: 'var(--foreground)' }}>
          {isLoading ? (
            <span className="inline-block w-32 h-8 rounded animate-pulse" style={{ background: 'var(--input)' }} />
          ) : hasBoekingen ? (
            formatTotalAmount(totalPeriodBoekingen)
          ) : (
            <span className="text-headline-md" style={{ color: 'var(--muted-foreground)' }}>Geen boekingen</span>
          )}
        </p>
        {!isLoading && hasBoekingen && percentChange !== null && (
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp size={14} style={{ color: '#065f46' }} strokeWidth={2} aria-hidden="true" />
            ) : (
              <TrendingDown size={14} style={{ color: '#ba1a1a' }} strokeWidth={2} aria-hidden="true" />
            )}
            <span className="text-label-sm" style={{ color: isPositive ? '#065f46' : '#ba1a1a' }}>
              {isPositive ? '+' : ''}{percentChange}% t.o.v. vorige maand
            </span>
          </div>
        )}
        {!isLoading && hasBoekingen && percentChange === null && prevMonthTotal === 0 && thisMonthTotal > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} style={{ color: '#065f46' }} strokeWidth={2} aria-hidden="true" />
            <span className="text-label-sm" style={{ color: '#065f46' }}>
              Eerste maand met boekingen
            </span>
          </div>
        )}
        {!isLoading && !hasBoekingen && allDocuments.length > 0 && (
          <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
            Open een bonnetje en kies &quot;Verwerk als boeking&quot; om bedragen te registreren.
          </p>
        )}
      </div>

      {/* Period filter */}
      <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />

      {/* Recent uploads section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-headline-sm" style={{ color: 'var(--foreground)' }}>
          Recent geüpload
        </h2>
        <Link
          href="/boekingen-archief"
          className="flex items-center gap-0.5 text-label-md transition-opacity hover:opacity-70"
          style={{ color: 'var(--primary)' }}
        >
          Bekijk alles
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
      </div>

      {/* Status filter chips */}
      <div
        className="flex items-center gap-2 mb-4 overflow-x-auto pb-1"
        role="group"
        aria-label="Status filter"
        style={{ scrollbarWidth: 'none' }}
      >
        {statusFilters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onStatusFilterChange(key)}
            className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-all duration-200 ${
              statusFilter === key ? 'filter-chip-active' : 'filter-chip-inactive'
            }`}
            aria-pressed={statusFilter === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Document list */}
      <div className="flex flex-col gap-3 mb-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-base flex items-center gap-3 p-3 animate-pulse">
              <div className="w-14 h-14 rounded-md flex-shrink-0" style={{ background: 'var(--input)' }} />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3.5 rounded w-3/4" style={{ background: 'var(--input)' }} />
                <div className="h-3 rounded w-1/3" style={{ background: 'var(--input)' }} />
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0 space-y-2">
                <div className="h-3.5 rounded w-14" style={{ background: 'var(--input)' }} />
                <div className="h-5 rounded w-20" style={{ background: 'var(--input)' }} />
              </div>
            </div>
          ))
        ) : documents.length === 0 ? (
          <p className="text-label-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
            {statusFilter === 'alle' ? 'Nog geen documenten geüpload'
              : statusFilter === 'nog_te_verwerken' ? 'Geen documenten met status "Nog te verwerken"'
              : 'Geen verwerkte documenten'}
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="card-base flex items-center gap-3 p-3 transition-colors duration-150"
            >
              {/* Thumbnail — clickable */}
              <button
                className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center focus:outline-none"
                style={{ background: 'var(--input)' }}
                onClick={() => setSelectedDoc(doc)}
                aria-label={`Preview van ${doc.fileName}`}
              >
                {doc.publicUrl && !isPdf(doc) ? (
                  <AppImage
                    src={doc.publicUrl}
                    alt={`Thumbnail van ${doc.fileName}`}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText size={22} style={{ color: 'var(--muted-foreground)' }} />
                )}
              </button>

              {/* Info — clickable */}
              <button
                className="flex-1 min-w-0 text-left focus:outline-none"
                onClick={() => setSelectedDoc(doc)}
                aria-label={`Open details van ${doc.fileName}`}
              >
                <p
                  className="text-label-md truncate mb-0.5"
                  style={{ color: 'var(--foreground)', letterSpacing: '0' }}
                >
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDate(doc.createdAt)}
                  </p>
                  {doc.bron === 'email' && (
                    <span className="inline-flex items-center rounded-full text-[9px] font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-700" style={{ letterSpacing: '0.04em' }}>
                      via e-mail
                    </span>
                  )}
                </div>
              </button>

              {/* Amount + status + delete */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span
                  className="text-label-md font-tabular"
                  style={{ color: 'var(--foreground)', fontWeight: 700 }}
                >
                  {formatAmount(doc.amount)}
                </span>
                <StatusBadge status={doc.docStatus} size="sm" />
                <button
                  onClick={() => setConfirmDeleteDoc(doc)}
                  disabled={deletingId === doc.id}
                  className="mt-0.5 w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-40"
                  aria-label={`Verwijder ${doc.fileName}`}
                >
                  <Trash2 size={15} strokeWidth={2} style={{ color: 'var(--error, #ba1a1a)' }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 pb-6">
        <button
          onClick={onCamera}
          disabled={isUploading}
          className="btn-primary w-full flex items-center justify-center gap-2.5 px-6 py-3.5 disabled:opacity-60"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Uploaden...</span>
            </>
          ) : (
            <>
              <Camera size={20} strokeWidth={2} className="text-white" />
              <span>Bonnetje fotograferen</span>
            </>
          )}
        </button>

        <button
          onClick={onGallery}
          disabled={isUploading}
          className="btn-secondary w-full flex items-center justify-center gap-2.5 px-6 py-3.5 disabled:opacity-60"
        >
          <Image size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} />
          <span>Kies uit galerij</span>
        </button>
      </div>

      {/* Detail modal */}
      {selectedDoc && (
        <DetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => onDocumentDeleted(selectedDoc.id)}
          onBoekingCreated={onBoekingCreated}
        />
      )}

      {/* Inline delete confirmation */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-headline-sm mb-2" style={{ color: 'var(--foreground)' }}>
              Bestand verwijderen?
            </h3>
            <p className="text-body-md mb-5" style={{ color: 'var(--muted-foreground)' }}>
              Weet je zeker dat je dit bestand wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={!!deletingId}
                className="flex-1 btn-secondary py-3 disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                onClick={handleInlineDelete}
                disabled={!!deletingId}
                className="flex-1 py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--error, #ba1a1a)' }}
              >
                {deletingId ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}