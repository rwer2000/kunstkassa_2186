'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Camera, Settings, Receipt, TrendingUp, Scale, Wrench } from 'lucide-react';
import { documentService } from '@/lib/services/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';


const navItems = [
  { key: 'nav-dashboard', label: 'Dashboard', href: '/', icon: LayoutGrid, isButton: false },
  { key: 'nav-archief', label: 'Archief', href: '/boekingen-archief', icon: BookOpen, isButton: false },
  { key: 'nav-upload', label: 'Upload', href: null, icon: Camera, isButton: true },
  { key: 'nav-btw', label: 'BTW', href: '/btw-aangifte', icon: Receipt, isButton: false },
  { key: 'nav-wenv', label: 'W&V', href: '/wenv', icon: TrendingUp, isButton: false },
  { key: 'nav-balans', label: 'Balans', href: '/balans', icon: Scale, isButton: false },
  { key: 'nav-beheer', label: 'Beheer', href: '/beheer', icon: Wrench, isButton: false },
  { key: 'nav-instellingen', label: 'Instellingen', href: '/instellingen', icon: Settings, isButton: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = (href: string | null) => {
    if (!href) return false;
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error('Je moet ingelogd zijn om bestanden te uploaden');
      e.target.value = '';
      return;
    }

    try {
      const uploaded = await documentService.uploadDocument(file, user.id);
      if (uploaded) {
        toast.success('Bonnetje geüpload', {
          description: `${file.name} is toegevoegd aan je administratie.`,
        });
        // Dispatch event so DashboardContent can reload
        window.dispatchEvent(new CustomEvent('document-uploaded'));
      } else {
        toast.error('Upload mislukt', { description: 'Probeer het opnieuw.' });
      }
    } catch (error: any) {
      toast.error('Upload mislukt', { description: error?.message || 'Er is een fout opgetreden.' });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <>
      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileSelected}
        className="hidden"
        aria-label="Bestand uploaden"
      />

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
                  aria-label="Bestand uploaden"
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