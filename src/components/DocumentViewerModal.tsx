'use client';

import React, { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { documentService, UploadedDocument } from '@/lib/services/documentService';
import AppImage from '@/components/ui/AppImage';

interface DocumentViewerModalProps {
  documentId: string;
  onClose: () => void;
}

function isPdf(doc: UploadedDocument): boolean {
  return doc.mimeType === 'application/pdf';
}

/** Gedeelde viewer voor een brondocument (factuur/bonnetje), op basis van een
 *  documents-id. Gebruikt vanuit Grootboek en W&V om vanuit een boeking het
 *  onderliggende bestand te bekijken. */
export default function DocumentViewerModal({ documentId, onClose }: DocumentViewerModalProps) {
  const [doc, setDoc] = useState<UploadedDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    documentService.getDocumentById(documentId).then((d) => {
      if (cancelled) return;
      if (d) setDoc(d);
      else setNotFound(true);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-lg rounded-t-2xl flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}
      >
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="text-headline-sm font-semibold truncate pr-3" style={{ color: 'var(--foreground)' }}>
            {doc?.fileName ?? 'Brondocument'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted flex-shrink-0"
            aria-label="Sluiten"
          >
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 flex items-center justify-center">
          {isLoading ? (
            <p className="text-label-md" style={{ color: 'var(--muted-foreground)' }}>Laden...</p>
          ) : notFound || !doc?.publicUrl ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText size={40} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-label-md text-center" style={{ color: 'var(--muted-foreground)' }}>
                Geen brondocument beschikbaar.
              </p>
            </div>
          ) : isPdf(doc) ? (
            <iframe
              src={doc.publicUrl}
              title={doc.fileName}
              className="w-full rounded-xl border"
              style={{ height: '65vh', borderColor: 'var(--border)' }}
            />
          ) : (
            <div className="w-full max-w-md">
              <AppImage
                src={doc.publicUrl}
                alt={`Preview van ${doc.fileName}`}
                width={600}
                height={800}
                className="w-full rounded-xl object-contain"
                style={{ maxHeight: '65vh' }}
              />
            </div>
          )}
        </div>

        {doc?.publicUrl && (
          <div className="px-5 pb-6 pt-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <a
              href={doc.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full btn-secondary py-3 text-label-md flex items-center justify-center gap-2"
            >
              <Download size={16} strokeWidth={2} />
              Openen in nieuw tabblad
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
