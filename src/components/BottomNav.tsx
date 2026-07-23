'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Camera, Settings, Wrench, X, CheckCircle, AlertCircle } from 'lucide-react';
import { documentService } from '@/lib/services/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';


const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const navItems = [
  { key: 'nav-dashboard', label: 'Dashboard', href: '/', icon: LayoutGrid, isButton: false },
  { key: 'nav-boekhouden', label: 'Boekhouden', href: '/boekhouden', icon: BookOpen, isButton: false },
  { key: 'nav-upload', label: 'Upload', href: null, icon: Camera, isButton: true },
  { key: 'nav-beheer', label: 'Beheer', href: '/beheer', icon: Wrench, isButton: false },
  { key: 'nav-instellingen', label: 'Instellingen', href: '/instellingen', icon: Settings, isButton: false },
];

interface UploadResult {
  name: string;
  ok: boolean;
  reason?: string;
}

interface UploadProgressState {
  total: number;
  done: number;
  results: UploadResult[];
  active: boolean;
}

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
        {/* Header */}
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

        {/* Progress bar */}
        {!isFinished && (
          <div className="mb-4">
            <div
              className="w-full rounded-full h-2 overflow-hidden"
              style={{ background: 'var(--muted)' }}
            >
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

        {/* Summary when finished */}
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

        {/* In-progress file list */}
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

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);

  const isActive = (href: string | null) => {
    if (!href) return false;
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';

    if (files.length === 0) return;

    if (!user) {
      toast.error('Je moet ingelogd zijn om bestanden te uploaden');
      return;
    }

    // Separate supported from unsupported
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

    // Show overlay immediately
    setUploadState({
      total,
      done: unsupported.length, // unsupported are "done" (skipped)
      results: [...unsupported],
      active: true,
    });

    // Upload supported files one by one
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

  const handleCloseOverlay = () => {
    setUploadState(null);
  };

  return (
    <>
      {/* Hidden file input — multiple + webkitdirectory for folder upload on desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        // @ts-ignore — webkitdirectory is non-standard but widely supported on desktop
        webkitdirectory={undefined}
        onChange={handleFilesSelected}
        className="hidden"
        aria-label="Bestanden uploaden"
      />

      {/* Upload progress overlay */}
      {uploadState && (
        <UploadProgressOverlay
          state={uploadState}
          onClose={handleCloseOverlay}
        />
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
        style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
        aria-label="Hoofdnavigatie"
      >
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            if (item.isButton) {
              return (
                <button
                  key={item.key}
                  onClick={handleUploadClick}
                  className="flex flex-col items-center justify-center min-w-[56px] min-h-[56px] relative"
                  aria-label="Bestanden uploaden"
                >
                  <span className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200">
                    <Icon
                      size={22}
                      strokeWidth={2}
                      className="text-muted-foreground"
                    />
                    <span className="text-label-sm transition-colors duration-200 text-muted-foreground">
                      {item.label}
                    </span>
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href!}
                className="flex flex-col items-center justify-center min-w-[56px] min-h-[56px] relative"
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 ${
                    active ? 'bottom-nav-pill' : ''
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 2}
                    className={active ? 'text-white' : 'text-muted-foreground'}
                  />
                  <span
                    className={`text-label-sm transition-colors duration-200 ${
                      active ? 'text-white' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}