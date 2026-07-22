import React from 'react';
import { Camera, Image, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AppImage from '@/components/ui/AppImage';
import { UploadedDocument } from '@/lib/services/documentService';

interface DashboardDataProps {
  documents: UploadedDocument[];
  isLoading: boolean;
  isUploading: boolean;
  onCamera: () => void;
  onGallery: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '—';
  return `€\u00a0${amount.toFixed(2).replace('.', ',')}`;
}

export default function DashboardData({ documents, isLoading, isUploading, onCamera, onGallery }: DashboardDataProps) {
  return (
    <div className="px-5 max-w-lg mx-auto">
      {/* Summary card */}
      <div className="card-base p-5 mb-6 mt-2">
        <p className="text-label-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
          Totaal deze maand
        </p>
        <p className="text-display-lg font-tabular mb-2" style={{ color: 'var(--foreground)' }}>
          € 1.432,50
        </p>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} style={{ color: '#065f46' }} strokeWidth={2} aria-hidden="true" />
          <span className="text-label-sm" style={{ color: '#065f46' }}>
            +12% t.o.v. vorige maand
          </span>
        </div>
      </div>

      {/* Recent uploads section */}
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

      {/* Document list */}
      <div className="flex flex-col gap-3 mb-6">
        {isLoading ? (
          // Skeleton loading state
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
            Nog geen documenten geüpload
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="card-base flex items-center gap-3 p-3 transition-colors duration-150 active:bg-muted cursor-pointer"
            >
              {/* Thumbnail */}
              <div
                className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--input)' }}
              >
                {doc.publicUrl ? (
                  <AppImage
                    src={doc.publicUrl}
                    alt={`Thumbnail van ${doc.fileName}`}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--border-subtle)' }}
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-label-md truncate mb-0.5"
                  style={{ color: 'var(--foreground)', letterSpacing: '0' }}
                >
                  {doc.fileName}
                </p>
                <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {formatDate(doc.createdAt)}
                </p>
              </div>

              {/* Amount + status */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span
                  className="text-label-md font-tabular"
                  style={{ color: 'var(--foreground)', fontWeight: 700 }}
                >
                  {formatAmount(doc.amount)}
                </span>
                <StatusBadge status={doc.docStatus} size="sm" />
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
    </div>
  );
}