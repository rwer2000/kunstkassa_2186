'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import DashboardEmpty from './DashboardEmpty';
import DashboardData from './DashboardData';
import { documentService, UploadedDocument } from '@/lib/services/documentService';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardContent() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'alle' | 'nog_te_verwerken' | 'verwerkt'>('alle');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    loadDocuments();
  }, [user]);

  // Listen for uploads triggered from BottomNav
  useEffect(() => {
    const handler = () => loadDocuments();
    window.addEventListener('document-uploaded', handler);
    return () => window.removeEventListener('document-uploaded', handler);
  }, []);

  const loadDocuments = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const docs = await documentService.getUserDocuments(user.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryPick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error('Je moet ingelogd zijn om bestanden te uploaden');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await documentService.uploadDocument(file, user.id);
      if (uploaded) {
        setDocuments((prev) => [uploaded, ...prev]);
        toast.success('Bonnetje geüpload', {
          description: `${file.name} is toegevoegd aan je administratie.`,
        });
      } else {
        toast.error('Upload mislukt', {
          description: 'Probeer het opnieuw.',
        });
      }
    } catch (error: any) {
      toast.error('Upload mislukt', {
        description: error?.message || 'Er is een fout opgetreden.',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const filteredDocuments = statusFilter === 'alle'
    ? documents
    : documents.filter((d) => d.docStatus === statusFilter);

  return (
    <>
      {/* Hidden file inputs */}
      {/* Camera: opens camera directly on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
        aria-label="Camera openen voor bonnetje"
      />
      {/* Gallery: pick from files, supports JPEG, PNG, PDF */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileSelected}
        className="hidden"
        aria-label="Bestand kiezen uit galerij"
      />

      {!isLoading && documents.length === 0 ? (
        <DashboardEmpty
          isUploading={isUploading}
          onCamera={handleCameraCapture}
        />
      ) : (
        <DashboardData
          documents={filteredDocuments}
          allDocuments={documents}
          isLoading={isLoading}
          isUploading={isUploading}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onCamera={handleCameraCapture}
          onGallery={handleGalleryPick}
          onDocumentDeleted={handleDeleteDocument}
        />
      )}
    </>
  );
}