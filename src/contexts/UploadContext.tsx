'use client';

import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { documentService } from '@/lib/services/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export interface UploadResult {
  name: string;
  ok: boolean;
  reason?: string;
}

export interface UploadProgressState {
  total: number;
  done: number;
  results: UploadResult[];
  active: boolean;
}

interface UploadContextValue {
  showUploadMenu: boolean;
  uploadState: UploadProgressState | null;
  openUploadMenu: () => void;
  closeUploadMenu: () => void;
  triggerFilesPicker: () => void;
  triggerFolderPicker: () => void;
  closeOverlay: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}

// ─── Progress Overlay ─────────────────────────────────────────────────────────

function UploadProgressOverlay({
  state,
  onClose,
}: {
  state: UploadProgressState;
  onClose: () => void;
}) {
  const isFinished = state.done === state.total;
  const succeeded = state.results.filter((r) => r.ok);
  const failed = state.results.filter((r) => !r.ok);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl px-5 pt-5 pb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {isFinished ? 'Upload voltooid' : 'Bezig met uploaden…'}
          </h3>
          {isFinished && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
              aria-label="Sluiten"
            >
              <X size={18} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
        </div>

        {!isFinished && (
          <div className="mb-4">
            <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  background: 'var(--primary)',
                  width: `${state.total > 0 ? (state.done / state.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-label-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              {state.done} van {state.total} bestanden geüpload
            </p>
          </div>
        )}

        {isFinished && (
          <div className="mb-4 flex flex-col gap-2">
            {succeeded.length > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
              >
                <CheckCircle size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span className="text-label-sm font-semibold" style={{ color: '#16a34a' }}>
                  {succeeded.length} bestand{succeeded.length !== 1 ? 'en' : ''} succesvol geüpload
                </span>
              </div>
            )}
            {failed.length > 0 && (
              <div
                className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={15} style={{ color: '#ba1a1a', flexShrink: 0 }} />
                  <span className="text-label-sm font-semibold" style={{ color: '#ba1a1a' }}>
                    {failed.length} bestand{failed.length !== 1 ? 'en' : ''} mislukt of overgeslagen
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {failed.map((r, i) => (
                    <li key={i} className="text-label-sm" style={{ color: '#ba1a1a' }}>
                      • {r.name}{r.reason ? ` — ${r.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isFinished && state.results.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {state.results.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-label-sm" style={{ color: 'var(--foreground)' }}>
                {r.ok
                  ? <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                  : <AlertCircle size={13} style={{ color: '#ba1a1a', flexShrink: 0 }} />
                }
                <span className="truncate">{r.name}</span>
              </li>
            ))}
          </ul>
        )}

        {isFinished && (
          <button onClick={onClose} className="w-full btn-primary py-3 mt-2">
            Sluiten
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Upload Menu Popup ────────────────────────────────────────────────────────

function UploadMenuPopup({
  onPickFiles,
  onPickFolder,
  onClose,
}: {
  onPickFiles: () => void;
  onPickFolder: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-2xl shadow-lg overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onPickFiles}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="text-body-sm font-medium">Bestanden kiezen</span>
        </button>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <button
          onClick={onPickFolder}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-body-sm font-medium">Map kiezen</span>
        </button>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const openUploadMenu = useCallback(() => setShowUploadMenu(true), []);
  const closeUploadMenu = useCallback(() => setShowUploadMenu(false), []);

  const triggerFilesPicker = useCallback(() => {
    setShowUploadMenu(false);
    fileInputRef.current?.click();
  }, []);

  const triggerFolderPicker = useCallback(() => {
    setShowUploadMenu(false);
    folderInputRef.current?.click();
  }, []);

  const closeOverlay = useCallback(() => setUploadState(null), []);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    if (!user) {
      toast.error('Je moet ingelogd zijn om bestanden te uploaden');
      return;
    }

    const supported: File[] = [];
    const unsupported: UploadResult[] = [];

    for (const f of files) {
      if (SUPPORTED_TYPES.includes(f.type)) {
        supported.push(f);
      } else {
        unsupported.push({ name: f.name, ok: false, reason: 'Niet ondersteund bestandstype (alleen PNG, JPEG, PDF)' });
      }
    }

    const total = supported.length + unsupported.length;

    setUploadState({
      total,
      done: unsupported.length,
      results: [...unsupported],
      active: true,
    });

    for (const file of supported) {
      try {
        const uploaded = await documentService.uploadDocument(file, user.id);
        setUploadState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            done: prev.done + 1,
            results: [...prev.results, { name: file.name, ok: !!uploaded }],
          };
        });
        if (uploaded) {
          window.dispatchEvent(new CustomEvent('document-uploaded'));
        }
      } catch (err: any) {
        setUploadState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            done: prev.done + 1,
            results: [...prev.results, { name: file.name, ok: false, reason: err?.message || 'Upload mislukt' }],
          };
        });
      }
    }
  };

  return (
    <UploadContext.Provider
      value={{
        showUploadMenu,
        uploadState,
        openUploadMenu,
        closeUploadMenu,
        triggerFilesPicker,
        triggerFolderPicker,
        closeOverlay,
      }}
    >
      {children}

      {/* Hidden inputs — always mounted */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
        aria-label="Bestanden uploaden"
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        // @ts-ignore
        webkitdirectory=""
        multiple
        onChange={handleFilesSelected}
        className="hidden"
        aria-label="Map uploaden"
      />

      {/* Upload choice menu */}
      {showUploadMenu && (
        <UploadMenuPopup
          onPickFiles={triggerFilesPicker}
          onPickFolder={triggerFolderPicker}
          onClose={closeUploadMenu}
        />
      )}

      {/* Upload progress overlay */}
      {uploadState && (
        <UploadProgressOverlay state={uploadState} onClose={closeOverlay} />
      )}
    </UploadContext.Provider>
  );
}
