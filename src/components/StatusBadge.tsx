import React from 'react';

interface StatusBadgeProps {
  status: 'verwerkt' | 'nog_te_verwerken';
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const isVerwerkt = status === 'verwerkt';
  const label = isVerwerkt ? 'VERWERKT' : 'NOG TE VERWERKEN';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide whitespace-nowrap ${
        isVerwerkt ? 'status-verwerkt' : 'status-pending'
      } ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
      style={{ letterSpacing: '0.04em' }}
      aria-label={isVerwerkt ? 'Verwerkt' : 'Nog te verwerken'}
    >
      {isVerwerkt && (
        <svg className="w-2.5 h-2.5 mr-1" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </span>
  );
}