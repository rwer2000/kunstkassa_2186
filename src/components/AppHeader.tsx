'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string;
}

export default function AppHeader({ userName = 'Gebruiker', avatarUrl }: AppHeaderProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
            Helder Finance
          </span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 focus:outline-none"
            style={{ borderColor: menuOpen ? 'var(--primary)' : 'var(--border)' }}
            aria-label={`Profiel van ${userName}`}
            aria-expanded={menuOpen}
          >
            {avatarUrl ? (
              <AppImage
                src={avatarUrl}
                alt={`Profielfoto van ${userName}, freelancer`}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--primary-dark)' }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-44 rounded-xl shadow-lg py-1 z-50"
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
                  {userName}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-label-md transition-colors duration-150"
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