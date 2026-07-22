import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Public_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'KunstKassa — Bonnetjes & Facturen voor ZZP\'ers',
  description: 'Fotografeer je bonnetjes en facturen en stuur ze direct naar je boekhouder. Altijd overzicht over je administratie.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KunstKassa',
  },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: '/icons/icon-192.png',
  },
  themeColor: '#0D4E5E',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={publicSans.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fkunstkassa3773back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body className={publicSans.className}>
        {children}
        <Toaster
          position="bottom-center"
          offset={96}
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            },
          }}
        />
      </body>
    </html>
  );
}