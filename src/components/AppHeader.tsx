import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string;
}

export default function AppHeader({ userName = 'Sophie', avatarUrl }: AppHeaderProps) {
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
        <div
          className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
          aria-label={`Profiel van ${userName}`}
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
        </div>
      </div>
    </header>
  );
}