import React from 'react';
import { Camera, Receipt } from 'lucide-react';

interface DashboardEmptyProps {
  isUploading: boolean;
  onCamera: () => void;
}

export default function DashboardEmpty({ isUploading, onCamera }: DashboardEmptyProps) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] px-5 max-w-lg mx-auto">
      {/* Upload zone */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <div
          className="w-full relative card-base p-5 mb-8"
          style={{ background: 'var(--card)' }}
        >
          {/* Camera FAB */}
          <button
            onClick={onCamera}
            className="absolute -top-4 -right-4 z-10 w-14 h-14 rounded-full flex items-center justify-center shadow-overlay-md transition-transform duration-150 active:scale-95"
            style={{ background: 'var(--primary)' }}
            aria-label="Bonnetje fotograferen"
          >
            <Camera size={24} className="text-white" strokeWidth={2} />
          </button>

          {/* Dashed zone */}
          <div className="dashed-upload-zone flex flex-col items-center justify-center py-16 px-8">
            <Receipt size={48} strokeWidth={1.5} style={{ color: 'var(--border-subtle)' }} />
          </div>
        </div>

        {/* Empty state copy */}
        <div className="text-center px-4">
          <h2
            className="text-headline-sm mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            Nog geen bonnetjes geüpload — maak je eerste foto
          </h2>
          <p
            className="text-body-md"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Scan je eerste uitgave om direct overzicht te krijgen in je administratie.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="pb-6">
        <button
          onClick={onCamera}
          disabled={isUploading}
          className="btn-primary w-full flex items-center justify-center gap-2.5 px-6 py-3.5 disabled:opacity-60"
          aria-label="Bonnetje fotograferen"
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
      </div>
    </div>
  );
}