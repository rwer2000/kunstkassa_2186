'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, Mail, Camera, LogOut, Check, Landmark } from 'lucide-react';
import { getProfiel, upsertProfiel, uploadAvatar, Profiel } from '@/lib/services/profielService';
import AppImage from '@/components/ui/AppImage';

export default function InstellingenContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [heeftZakelijkeRekening, setHeeftZakelijkeRekening] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingProfile(true);
    getProfiel(user.id).then((p) => {
      if (p) {
        setProfiel(p);
        setNaam(p.naam ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '');
        setEmail(p.email ?? user?.email ?? '');
        setAvatarPreview(p.avatarUrl);
        setHeeftZakelijkeRekening(p.heeftZakelijkeRekening);
      } else {
        setNaam(user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '');
        setEmail(user?.email ?? '');
      }
      setLoadingProfile(false);
    });
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      let avatarPath = profiel?.avatarPath ?? null;

      if (pendingFile) {
        const uploaded = await uploadAvatar(user.id, pendingFile);
        if (uploaded) {
          avatarPath = uploaded;
        } else {
          setSaveError('Profielfoto uploaden mislukt. Probeer opnieuw.');
          setIsSaving(false);
          return;
        }
      }

      const updated = await upsertProfiel(user.id, {
        naam: naam.trim(),
        email: email.trim(),
        avatarPath,
        heeftZakelijkeRekening,
      });

      if (updated) {
        setProfiel(updated);
        setAvatarPreview(updated.avatarUrl);
        setPendingFile(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        window.dispatchEvent(new Event('profiel-updated'));
      } else {
        setSaveError('Opslaan mislukt. Probeer opnieuw.');
      }
    } catch {
      setSaveError('Er is iets misgegaan. Probeer opnieuw.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-up-login-screen');
    } catch {
      setIsSigningOut(false);
    }
  };

  const displayInitial = (naam || user?.email?.split('@')[0] || 'G').charAt(0).toUpperCase();

  return (
    <div className="px-5 max-w-lg mx-auto pt-2 pb-8">
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label="Terug"
        >
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
          Instellingen
        </h1>
      </div>

      {loadingProfile ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--primary)' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <>
          {/* Avatar upload */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-3">
              <div
                className="w-20 h-20 rounded-full overflow-hidden border-2 flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                {avatarPreview ? (
                  <AppImage
                    src={avatarPreview}
                    alt="Profielfoto"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--primary-dark)' }}
                  >
                    {displayInitial}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                style={{ background: 'var(--primary)', color: '#fff' }}
                aria-label="Profielfoto wijzigen"
                type="button"
              >
                <Camera size={14} strokeWidth={2.5} />
              </button>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium"
              style={{ color: 'var(--primary)' }}
              type="button"
            >
              Foto wijzigen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
              aria-label="Profielfoto uploaden"
            />
          </div>

          {/* Editable fields */}
          <p className="text-xs font-semibold mb-2 px-1 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
            Account
          </p>
          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Naam */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <User size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="naam-input"
                  className="text-xs block mb-0.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Naam
                </label>
                <input
                  id="naam-input"
                  type="text"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Jouw naam"
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:opacity-40"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
            </div>
            {/* E-mail */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Mail size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="email-input"
                  className="text-xs block mb-0.5"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  E-mailadres
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jouw@email.nl"
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:opacity-40"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
            </div>
          </div>

          {/* Zakelijke rekening toggle */}
          <p className="text-xs font-semibold mb-2 px-1 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
            Boekhouding
          </p>
          <div
            className="rounded-xl overflow-hidden mb-6 flex items-center gap-3 px-4 py-3.5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <Landmark size={18} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Zakelijke bankrekening</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Zet aan als je een aparte zakelijke rekening hebt. Bepaalt of Bankafstemming
                zichtbaar is en of boekingen standaard op Privé staan.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={heeftZakelijkeRekening}
              aria-label="Zakelijke bankrekening"
              onClick={() => setHeeftZakelijkeRekening((v) => !v)}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
              style={{ background: heeftZakelijkeRekening ? 'var(--primary)' : 'var(--border)' }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: heeftZakelijkeRekening ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          {/* Error message */}
          {saveError && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'var(--error-bg, #fff0f0)', color: 'var(--error, #ba1a1a)', border: '1px solid var(--error-border, #ffd0d0)' }}
            >
              {saveError}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-60 mb-8"
            style={{ background: saved ? '#1a7a4a' : 'var(--primary)' }}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Opslaan...</span>
              </>
            ) : saved ? (
              <>
                <Check size={18} strokeWidth={2.5} />
                <span>Opgeslagen!</span>
              </>
            ) : (
              <span>Opslaan</span>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--error, #ba1a1a)' }}
          >
            <LogOut size={18} strokeWidth={2} />
            <span>{isSigningOut ? 'Uitloggen...' : 'Uitloggen'}</span>
          </button>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--muted-foreground)' }}>
            KunstKassa v1.0
          </p>
        </>
      )}
    </div>
  );
}
