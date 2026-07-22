'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Camera, Settings } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const navItems = [
  { key: 'nav-dashboard', label: 'Dashboard', href: '/', icon: LayoutGrid },
  { key: 'nav-archief', label: 'Archief', href: '/boekingen-archief', icon: BookOpen },
  { key: 'nav-upload', label: 'Upload', href: '/dashboard#upload', icon: Camera },
  { key: 'nav-instellingen', label: 'Instellingen', href: '/instellingen', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href.split('#')[0]);
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
          return (
            <Link
              key={item.key}
              href={item.href}
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