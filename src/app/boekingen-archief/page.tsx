import React from 'react';
import AppLayout from '@/components/AppLayout';
import BoekingenContent from './components/BoekingenContent';

// Backend integration point: fetch boekingen from database
// const boekingen = await db.boekingen.findMany({ where: { userId: session.userId } });

export default function BoekingenArchiefPage() {
  return (
    <AppLayout
      userName="Sophie"
      avatarUrl="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face"
    >
      <BoekingenContent />
    </AppLayout>
  );
}