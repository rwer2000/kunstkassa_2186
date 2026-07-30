'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, TrendingUp, Scale, Receipt, Settings2 } from 'lucide-react';

interface Tegel {
  key: string;
  label: string;
  beschrijving: string;
  href: string;
  icon: React.ElementType;
  kleur: string;
}

const tegels: Tegel[] = [
  {
    key: 'grootboek',
    label: 'Grootboek',
    beschrijving: 'Boekingenoverzicht met filters',
    href: '/boekingen-archief',
    icon: BookOpen,
    kleur: 'var(--primary)',
  },
  {
    key: 'wenv',
    label: 'W&V',
    beschrijving: 'Winst- en verliesrekening',
    href: '/wenv',
    icon: TrendingUp,
    kleur: '#10b981',
  },
  {
    key: 'balans',
    label: 'Balans',
    beschrijving: 'Activa en passiva per peildatum',
    href: '/balans',
    icon: Scale,
    kleur: '#6366f1',
  },
  {
    key: 'btw',
    label: 'BTW-aangifte',
    beschrijving: 'BTW-overzicht per aangifteperiode',
    href: '/btw-aangifte',
    icon: Receipt,
    kleur: '#f59e0b',
  },
  {
    key: 'beheer',
    label: 'Beheer',
    beschrijving: 'Rekeningschema, beginbalans, vaste activa',
    href: '/beheer',
    icon: Settings2,
    kleur: '#64748b',
  },
];

export default function BoekhoudenContent() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-heading-md font-bold" style={{ color: 'var(--foreground)' }}>
          Boekhouden
        </h1>
        <p className="text-body-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Kies een onderdeel
        </p>
      </div>

      {/* Tiles grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {tegels.map((tegel) => {
          const IconComp = tegel.icon;
          return (
            <button
              key={tegel.key}
              onClick={() => router.push(tegel.href)}
              className="flex flex-col items-start p-4 rounded-2xl text-left transition-all duration-150 active:scale-95"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                style={{ background: `${tegel.kleur}1a` }}
              >
                <IconComp size={20} style={{ color: tegel.kleur }} strokeWidth={2} />
              </div>
              <span className="text-label-md font-semibold block" style={{ color: 'var(--foreground)' }}>
                {tegel.label}
              </span>
              <span className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                {tegel.beschrijving}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
