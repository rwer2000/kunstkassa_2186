import React from 'react';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import { UploadProvider } from '@/contexts/UploadContext';

interface AppLayoutProps {
  children: React.ReactNode;
  userName?: string;
  avatarUrl?: string;
}

export default function AppLayout({ children, userName, avatarUrl }: AppLayoutProps) {
  return (
    <UploadProvider>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <AppHeader userName={userName} avatarUrl={avatarUrl} />
        <main className="flex-1 pb-nav">
          {children}
        </main>
        <BottomNav />
      </div>
    </UploadProvider>
  );
}