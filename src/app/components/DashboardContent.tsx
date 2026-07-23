'use client';

import React, { useState, useEffect } from 'react';
import DashboardEmpty from './DashboardEmpty';
import DashboardData from './DashboardData';
import { documentService, UploadedDocument } from '@/lib/services/documentService';
import { boekingenService, Boeking } from '@/lib/services/boekingenService';
import { useAuth } from '@/contexts/AuthContext';
import { useUpload } from '@/contexts/UploadContext';

export default function DashboardContent() {
  const { user } = useAuth();
  const { openUploadMenu } = useUpload();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [boekingen, setBoekingen] = useState<Boeking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'alle' | 'nog_te_verwerken' | 'verwerkt'>('alle');

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    loadAll();
  }, [user]);

  // Listen for uploads triggered from anywhere (BottomNav or Dashboard buttons)
  useEffect(() => {
    const handler = () => loadAll();
    window.addEventListener('document-uploaded', handler);
    return () => window.removeEventListener('document-uploaded', handler);
  }, []);

  const loadAll = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [docs, bkn] = await Promise.all([
        documentService.getUserDocuments(user.id),
        boekingenService.getBoekingen(),
      ]);
      setDocuments(docs);
      setBoekingen(bkn);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleBoekingCreated = (boeking: Boeking) => {
    setBoekingen((prev) => [boeking, ...prev]);
    loadAll();
  };

  const filteredDocuments = statusFilter === 'alle'
    ? documents
    : documents.filter((d) => d.docStatus === statusFilter);

  return (
    <>
      {!isLoading && documents.length === 0 ? (
        <DashboardEmpty
          isUploading={false}
          onCamera={openUploadMenu}
        />
      ) : (
        <DashboardData
          documents={filteredDocuments}
          allDocuments={documents}
          boekingen={boekingen}
          isLoading={isLoading}
          isUploading={false}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onCamera={openUploadMenu}
          onGallery={openUploadMenu}
          onDocumentDeleted={handleDeleteDocument}
          onBoekingCreated={handleBoekingCreated}
        />
      )}
    </>
  );
}