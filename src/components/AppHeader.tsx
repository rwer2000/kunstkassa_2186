'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut, Settings } from 'lucide-react';
import { getProfiel, Profiel } from '@/lib/services/profielService';

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string;
}

export default function AppHeader({ userName, avatarUrl }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [profiel, setProfiel] = useState<Profiel | null>(null);

  const loadProfiel = useCallback(async () => {
    if (!user?.id) return;
    const p = await getProfiel(user.id);
    setProfiel(p);
  }, [user?.id]);

  useEffect(() => {
    loadProfiel();
  }, [loadProfiel]);

  // Listen for profile updates from settings screen
  useEffect(() => {
    const handler = () => loadProfiel();
    window.addEventListener('profiel-updated', handler);
    return () => window.removeEventListener('profiel-updated', handler);
  }, [loadProfiel]);

  // Derive display name: profiel > auth metadata > prop > fallback
  const displayName =
    profiel?.naam ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')?.[0] ||
    userName ||
    'Gebruiker';

  const displayEmail =
    profiel?.email ||
    user?.email ||
    '';

  const displayAvatarUrl =
    profiel?.avatarUrl ||
    avatarUrl ||
    null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Je bent uitgelogd');
      router.replace('/sign-up-login-screen');
      router.refresh();
    } catch {
      toast.error('Uitloggen mislukt');
    }
    setMenuOpen(false);
  };

  const handleSettings = () => {
    setMenuOpen(false);
    router.push('/instellingen');
  };

  return (
    <header
      className="sticky top-0 z-40 safe-top"
      style={{ background: 'var(--background)' }}
    >
      <div className="flex items-center justify-between px-5 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span
            className="font-sans text-xl font-bold tracking-tight"
            style={{ color: 'var(--primary-dark)', letterSpacing: '-0.01em' }}
          >
            KunstKassa
          </span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 focus:outline-none"
            style={{ borderColor: menuOpen ? 'var(--primary)' : 'var(--border)' }}
            aria-label={`Profiel van ${displayName}`}
            aria-expanded={menuOpen}
          >
            {displayAvatarUrl ? (
              <AppImage
                src={displayAvatarUrl}
                alt={`Profielfoto van ${displayName}`}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--primary-dark)' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-1 z-50"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="px-4 py-2 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-label-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                  {displayName}
                </p>
                {displayEmail && (
                  <p className="text-label-sm truncate mt-0.5" style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>
                    {displayEmail}
                  </p>
                )}
              </div>
              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-label-md transition-colors duration-150 hover:bg-muted"
                style={{ color: 'var(--foreground)' }}
              >
                <Settings size={16} strokeWidth={2} />
                <span>Instellingen</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-label-md transition-colors duration-150 hover:bg-muted"
                style={{ color: 'var(--error, #ba1a1a)' }}
              >
                <LogOut size={16} strokeWidth={2} />
                <span>Uitloggen</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}