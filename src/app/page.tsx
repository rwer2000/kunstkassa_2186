import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardContent from './components/DashboardContent';

// Backend integration point: fetch user session and documents from database
// const session = await getServerSession();
// const documents = await db.documents.findMany({ where: { userId: session.userId } });

export default function DashboardPage() {
  return (
    <AppLayout
      userName="Sophie"
      avatarUrl="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face"
    >
      <DashboardContent />
    </AppLayout>
  );
}