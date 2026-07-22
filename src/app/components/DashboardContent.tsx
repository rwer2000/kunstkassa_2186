'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import DashboardEmpty from './DashboardEmpty';
import DashboardData from './DashboardData';

export default function DashboardContent() {
  // Backend integration point: replace with real document fetch
  const [hasDocuments, setHasDocuments] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryPick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Backend integration point: upload file to storage (Supabase Storage / Vercel Blob)
    // const formData = new FormData();
    // formData.append('file', file);
    // await fetch('/api/documents/upload', { method: 'POST', body: formData });

    await new Promise((r) => setTimeout(r, 1500));
    setIsUploading(false);
    setHasDocuments(true);
    toast.success('Bonnetje geüpload', {
      description: `${file.name} is toegevoegd aan je administratie.`,
    });

    // Reset input
    e.target.value = '';
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        aria-label="Camera openen voor bonnetje"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileSelected}
        aria-label="Bestand kiezen uit galerij"
      />

      {hasDocuments ? (
        <DashboardData
          isUploading={isUploading}
          onCamera={handleCameraCapture}
          onGallery={handleGalleryPick}
        />
      ) : (
        <DashboardEmpty
          isUploading={isUploading}
          onCamera={handleCameraCapture}
        />
      )}
    </>
  );
}