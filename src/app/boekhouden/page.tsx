'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import BoekhoudenContent from './components/BoekhoudenContent';
import { useAuth } from '@/contexts/AuthContext';

export default function BoekhoudenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router?.replace('/sign-up-login-screen');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--primary)' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <BoekhoudenContent />
    </AppLayout>
  );
}
