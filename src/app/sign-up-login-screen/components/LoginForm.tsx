'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { toast } from 'sonner';

interface LoginFormValues {
  email: string;
  wachtwoord: string;
}

const DEMO_CREDENTIALS = {
  email: 'sophie.van.dijk@kunstkassa.nl',
  password: 'KunstKassa2024!',
};

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>();

  const handleCopy = async (field: 'email' | 'password') => {
    const value = field === 'email' ? DEMO_CREDENTIALS.email : DEMO_CREDENTIALS.password;
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fillDemoCredentials = () => {
    setValue('email', DEMO_CREDENTIALS.email);
    setValue('wachtwoord', DEMO_CREDENTIALS.password);
    toast.success('Demo-gegevens ingevuld');
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);

    // Backend integration point: replace with real auth (NextAuth / Supabase Auth)
    await new Promise((r) => setTimeout(r, 1200));

    if (
      data.email === DEMO_CREDENTIALS.email &&
      data.wachtwoord === DEMO_CREDENTIALS.password
    ) {
      toast.success('Welkom terug, Sophie!');
      router.push('/');
    } else {
      setError('root', {
        message: 'Ongeldige inloggegevens — gebruik de demo-accounts hieronder om in te loggen',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-sm">
      {/* Brand header */}
      <div className="flex flex-col items-center mb-10">
        <div className="flex items-center gap-2.5 mb-2">
          <AppLogo size={36} />
          <span
            className="text-headline-md"
            style={{ color: 'var(--primary-dark)' }}
          >
            Helder Finance
          </span>
        </div>
        <p className="text-label-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
          Inloggen bij KunstKassa
        </p>
      </div>

      {/* Form card */}
      <div className="card-base p-6 mb-5">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Root error */}
          {errors.root && (
            <div
              className="rounded-md px-4 py-3 mb-5 text-sm"
              style={{
                background: 'var(--error-container, #ffdad6)',
                color: 'var(--error, #ba1a1a)',
                border: '1px solid rgba(186, 26, 26, 0.2)',
              }}
              role="alert"
            >
              {errors.root.message}
            </div>
          )}

          {/* Email field */}
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-label-md mb-1.5"
              style={{ color: 'var(--foreground)' }}
            >
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="naam@bedrijf.nl"
              className="w-full px-4 py-3 rounded text-body-md outline-none transition-all duration-150"
              style={{
                background: 'var(--input)',
                border: errors.email
                  ? '1.5px solid var(--error, #ba1a1a)'
                  : '1.5px solid var(--border)',
                color: 'var(--foreground)',
              }}
              {...register('email', {
                required: 'E-mailadres is verplicht',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Voer een geldig e-mailadres in',
                },
              })}
              onFocus={(e) => {
                if (!errors.email) {
                  e.target.style.border = '1.5px solid var(--primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(13, 78, 94, 0.1)';
                }
              }}
              onBlur={(e) => {
                if (!errors.email) {
                  e.target.style.border = '1.5px solid var(--border)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            />
            {errors.email && (
              <p className="mt-1.5 text-label-sm" style={{ color: 'var(--error, #ba1a1a)' }} role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-6">
            <label
              htmlFor="wachtwoord"
              className="block text-label-md mb-1.5"
              style={{ color: 'var(--foreground)' }}
            >
              Wachtwoord
            </label>
            <div className="relative">
              <input
                id="wachtwoord"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-12 rounded text-body-md outline-none transition-all duration-150"
                style={{
                  background: 'var(--input)',
                  border: errors.wachtwoord
                    ? '1.5px solid var(--error, #ba1a1a)'
                    : '1.5px solid var(--border)',
                  color: 'var(--foreground)',
                }}
                {...register('wachtwoord', {
                  required: 'Wachtwoord is verplicht',
                  minLength: {
                    value: 6,
                    message: 'Wachtwoord moet minimaal 6 tekens zijn',
                  },
                })}
                onFocus={(e) => {
                  if (!errors.wachtwoord) {
                    e.target.style.border = '1.5px solid var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(13, 78, 94, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  if (!errors.wachtwoord) {
                    e.target.style.border = '1.5px solid var(--border)';
                    e.target.style.boxShadow = 'none';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors duration-150"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>
            {errors.wachtwoord && (
              <p className="mt-1.5 text-label-sm" style={{ color: 'var(--error, #ba1a1a)' }} role="alert">
                {errors.wachtwoord.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Inloggen...</span>
              </>
            ) : (
              <span>Inloggen</span>
            )}
          </button>
        </form>
      </div>

      {/* Demo credentials box */}
      <div
        className="rounded-lg p-4 border"
        style={{
          background: 'rgba(13, 78, 94, 0.04)',
          borderColor: 'rgba(13, 78, 94, 0.15)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-label-sm font-semibold" style={{ color: 'var(--primary)' }}>
            Demo-account
          </p>
          <button
            onClick={fillDemoCredentials}
            className="text-label-sm px-2.5 py-1 rounded transition-colors duration-150 font-semibold"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: '11px',
            }}
          >
            Gebruik demo
          </button>
        </div>

        <div className="space-y-2">
          {/* Email row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-label-sm" style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>
                E-mail
              </p>
              <p
                className="text-label-sm truncate"
                style={{ color: 'var(--foreground)', maxWidth: '200px' }}
              >
                {DEMO_CREDENTIALS.email}
              </p>
            </div>
            <button
              onClick={() => handleCopy('email')}
              className="flex-shrink-0 p-1.5 rounded transition-colors duration-150"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label="E-mailadres kopiëren"
            >
              {copiedField === 'email' ? (
                <Check size={14} style={{ color: '#065f46' }} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>

          {/* Password row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-label-sm" style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>
                Wachtwoord
              </p>
              <p className="text-label-sm" style={{ color: 'var(--foreground)' }}>
                {DEMO_CREDENTIALS.password}
              </p>
            </div>
            <button
              onClick={() => handleCopy('password')}
              className="flex-shrink-0 p-1.5 rounded transition-colors duration-150"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label="Wachtwoord kopiëren"
            >
              {copiedField === 'password' ? (
                <Check size={14} style={{ color: '#065f46' }} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}