'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, User, Mail, LogOut, Bell, Shield, HelpCircle } from 'lucide-react';

export default function InstellingenContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')?.[0] ||
    'Gebruiker';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('Je bent uitgelogd');
      router.replace('/sign-up-login-screen');
    } catch {
      toast.error('Uitloggen mislukt');
      setIsSigningOut(false);
    }
  };

  return (
    <div className="px-5 max-w-lg mx-auto pt-2 pb-8">
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label="Terug"
        >
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h1 className="text-headline-md font-bold" style={{ color: 'var(--foreground)' }}>
          Instellingen
        </h1>
      </div>

      {/* Profile card */}
      <div
        className="card-base p-5 mb-6 flex items-center gap-4"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--primary-dark)' }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-headline-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {displayName}
          </p>
          {user?.email && (
            <p className="text-label-sm truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {user.email}
            </p>
          )}
        </div>
      </div>

      {/* Account section */}
      <p className="text-label-sm font-semibold mb-2 px-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
        ACCOUNT
      </p>
      <div className="card-base mb-6 overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <User size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>Naam</p>
            <p className="text-label-md font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Mail size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm" style={{ color: 'var(--muted-foreground)' }}>E-mailadres</p>
            <p className="text-label-md font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {user?.email || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Preferences section */}
      <p className="text-label-sm font-semibold mb-2 px-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
        VOORKEUREN
      </p>
      <div className="card-base mb-6 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b text-left transition-colors hover:bg-muted"
          style={{ borderColor: 'var(--border)' }}
        >
          <Bell size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-label-md" style={{ color: 'var(--foreground)' }}>Meldingen</span>
          <ChevronLeft size={16} strokeWidth={2} className="ml-auto rotate-180" style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
        >
          <Shield size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-label-md" style={{ color: 'var(--foreground)' }}>Privacy & beveiliging</span>
          <ChevronLeft size={16} strokeWidth={2} className="ml-auto rotate-180" style={{ color: 'var(--muted-foreground)' }} />
        </button>
      </div>

      {/* Support section */}
      <p className="text-label-sm font-semibold mb-2 px-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
        ONDERSTEUNING
      </p>
      <div className="card-base mb-6 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
        >
          <HelpCircle size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-label-md" style={{ color: 'var(--foreground)' }}>Help & contact</span>
          <ChevronLeft size={16} strokeWidth={2} className="ml-auto rotate-180" style={{ color: 'var(--muted-foreground)' }} />
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ background: 'var(--error, #ba1a1a)' }}
      >
        <LogOut size={18} strokeWidth={2} />
        <span>{isSigningOut ? 'Uitloggen...' : 'Uitloggen'}</span>
      </button>

      <p className="text-center text-label-sm mt-6" style={{ color: 'var(--muted-foreground)' }}>
        KunstKassa v1.0
      </p>
    </div>
  );
}
