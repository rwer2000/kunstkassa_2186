import React from 'react';
import { Camera, Image, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AppImage from '@/components/ui/AppImage';

interface Document {
  id: string;
  fileName: string;
  date: string;
  amount: string;
  status: 'verwerkt' | 'nog_te_verwerken';
  thumbnailUrl?: string;
}

const mockDocuments: Document[] = [
  {
    id: 'doc-001',
    fileName: 'Albert Heijn Lunch...',
    date: '12 okt 2023',
    amount: '€\u00a014,85',
    status: 'verwerkt',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop',
  },
  {
    id: 'doc-002',
    fileName: 'Shell Brandstof...',
    date: '14 okt 2023',
    amount: '€\u00a068,20',
    status: 'nog_te_verwerken',
  },
  {
    id: 'doc-003',
    fileName: 'Bol.com Kantoor...',
    date: '15 okt 2023',
    amount: '€\u00a0124,99',
    status: 'nog_te_verwerken',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=80&h=80&fit=crop',
  },
  {
    id: 'doc-004',
    fileName: 'NS Treinkaartje',
    date: '16 okt 2023',
    amount: '€\u00a022,40',
    status: 'verwerkt',
  },
  {
    id: 'doc-005',
    fileName: 'Coolblue Monitor...',
    date: '18 okt 2023',
    amount: '€\u00a0349,00',
    status: 'nog_te_verwerken',
    thumbnailUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=80&h=80&fit=crop',
  },
];

interface DashboardDataProps {
  isUploading: boolean;
  onCamera: () => void;
  onGallery: () => void;
}

export default function DashboardData({ isUploading, onCamera, onGallery }: DashboardDataProps) {
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
        {mockDocuments.map((doc) => (
          <div
            key={doc.id}
            className="card-base flex items-center gap-3 p-3 transition-colors duration-150 active:bg-muted cursor-pointer"
          >
            {/* Thumbnail */}
            <div
              className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: 'var(--input)' }}
            >
              {doc.thumbnailUrl ? (
                <AppImage
                  src={doc.thumbnailUrl}
                  alt={`Thumbnail van ${doc.fileName}, bonnetje`}
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
                {doc.date}
              </p>
            </div>

            {/* Amount + status */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span
                className="text-label-md font-tabular"
                style={{ color: 'var(--foreground)', fontWeight: 700 }}
              >
                {doc.amount}
              </span>
              <StatusBadge status={doc.status} size="sm" />
            </div>
          </div>
        ))}
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