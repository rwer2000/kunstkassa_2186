'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Camera, Settings, Landmark } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';
import Icon from '@/components/ui/AppIcon';


const navItems = [
  { key: 'nav-dashboard', label: 'Dashboard', href: '/', icon: LayoutGrid, isButton: false },
  { key: 'nav-boekhouden', label: 'Boekhouden', href: '/boekhouden', icon: BookOpen, isButton: false },
  { key: 'nav-upload', label: 'Upload', href: null, icon: Camera, isButton: true },
  { key: 'nav-bank', label: 'Bank', href: '/bankafstemming', icon: Landmark, isButton: false },
  { key: 'nav-instellingen', label: 'Instellingen', href: '/instellingen', icon: Settings, isButton: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { openUploadMenu } = useUpload();

  const isActive = (href: string | null) => {
    if (!href) return false;
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
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
                onClick={openUploadMenu}
                className="flex flex-col items-center justify-center min-w-[56px] min-h-[56px] relative"
                aria-label="Bestanden uploaden"
              >
                <span className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200">
                  <Icon size={22} strokeWidth={2} className="text-muted-foreground" />
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
  );
}