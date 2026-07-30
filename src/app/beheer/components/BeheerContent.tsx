'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Scale,
  Building2,
  Link2,
  ChevronLeft,
  Plus,
  Pencil,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type Categorie = 'Omzet' | 'Kosten' | 'BTW' | 'Activa' | 'Overig' | 'Eigen vermogen';

interface Rekening {
  code: string;
  naam: string;
  categorie: Categorie | null;
  standaard_btw_percentage: number | null;
  actief: boolean;
}

interface VasteActivum {
  id: string;
  naam: string;
  rekeningcode: string;
  aanschafwaarde: number;
  aanschafdatum: string;
  afschrijvingsduur_jaren: number;
}

interface Beginbalans {
  id: string;
  rekeningcode: string;
  bedrag: number;
  datum: string;
}

type ActivePanel = 'menu' | 'rekeningschema' | 'beginbalans' | 'vaste_activa' | 'koppeling';

const CATEGORIEEN: Categorie[] = ['Omzet', 'Kosten', 'BTW', 'Activa', 'Overig', 'Eigen vermogen'];

function formatEuro(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}€\u00a0${formatted}`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--primary)' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  );
}

// ─── Rekeningschema Panel ─────────────────────────────────────────────────────

function RekeningschemaPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [rekeningen, setRekeningen] = useState<Rekening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { code: '', naam: '', categorie: 'Omzet' as Categorie, standaard_btw_percentage: '', actief: true };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase.from('rekeningschema').select('*').eq('gebruiker_id', user.id).order('code');
    setRekeningen(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (r: Rekening) => {
    setEditingCode(r.code);
    setForm({
      code: r.code,
      naam: r.naam,
      categorie: (r.categorie as Categorie) || 'Omzet',
      standaard_btw_percentage: r.standaard_btw_percentage != null ? String(r.standaard_btw_percentage) : '',
      actief: r.actief,
    });
    setShowAddForm(false);
    setError(null);
  };

  const startAdd = () => {
    setForm(emptyForm);
    setShowAddForm(true);
    setEditingCode(null);
    setError(null);
  };

  const cancel = () => {
    setEditingCode(null);
    setShowAddForm(false);
    setError(null);
  };

  const save = async () => {
    if (!form.code.trim() || !form.naam.trim()) {
      setError('Code en naam zijn verplicht.');
      return;
    }
    if (!user) { setError('Niet ingelogd.'); return; }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      gebruiker_id: user.id,
      code: form.code.trim(),
      naam: form.naam.trim(),
      categorie: form.categorie,
      standaard_btw_percentage: form.standaard_btw_percentage !== '' ? Number(form.standaard_btw_percentage) : null,
      actief: form.actief,
    };

    if (showAddForm) {
      const { error: err } = await supabase.from('rekeningschema').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('rekeningschema').update({
        naam: payload.naam,
        categorie: payload.categorie,
        standaard_btw_percentage: payload.standaard_btw_percentage,
        actief: payload.actief,
      }).eq('gebruiker_id', user.id).eq('code', editingCode!);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await load();
    cancel();
    setSaving(false);
  };

  const isFormActive = showAddForm || editingCode !== null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors" aria-label="Terug">
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Rekeningschema</h2>
        <button
          onClick={startAdd}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity"
          style={{ background: 'var(--primary)' }}
          disabled={isFormActive}
        >
          <Plus size={16} strokeWidth={2.5} />
          Toevoegen
        </button>
      </div>

      {/* Inline form */}
      {isFormActive && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-label-md font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            {showAddForm ? 'Nieuwe rekening' : `Bewerk ${editingCode}`}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!showAddForm}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Naam *</label>
              <input
                type="text"
                value={form.naam}
                onChange={(e) => setForm({ ...form, naam: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Categorie</label>
              <select
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value as Categorie })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                {CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Standaard BTW %</label>
              <input
                type="number"
                value={form.standaard_btw_percentage}
                onChange={(e) => setForm({ ...form, standaard_btw_percentage: e.target.value })}
                placeholder="bijv. 21"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="actief-check"
              checked={form.actief}
              onChange={(e) => setForm({ ...form, actief: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="actief-check" className="text-sm" style={{ color: 'var(--foreground)' }}>Actief</label>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg, #fff0f0)', color: 'var(--error, #ba1a1a)' }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              <Check size={15} strokeWidth={2.5} />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--muted)', color: 'var(--foreground)' }}>
              <X size={15} strokeWidth={2.5} />
              Annuleren
            </button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          {rekeningen.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--muted-foreground)' }}>Geen rekeningen gevonden.</p>
          ) : rekeningen.map((r, idx) => (
            <div
              key={r.code}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: idx < rekeningen.length - 1 ? '1px solid var(--border)' : undefined, opacity: r.actief ? 1 : 0.5 }}
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  <span className="text-label-sm font-mono font-semibold" style={{ color: 'var(--muted-foreground)' }}>{r.code}</span>
                  <span className="text-body-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.naam}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{r.categorie}</span>
                  {r.standaard_btw_percentage != null && (
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>BTW {r.standaard_btw_percentage}%</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => startEdit(r)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
                aria-label={`Bewerk ${r.naam}`}
              >
                <Pencil size={15} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Beginbalans Panel ────────────────────────────────────────────────────────

function BeginbalansPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [rekeningen, setRekeningen] = useState<Rekening[]>([]);
  const [beginbalansen, setBeginbalansen] = useState<Beginbalans[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState({ bedrag: '', datum: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [rekRes, bbRes] = await Promise.all([
      supabase.from('rekeningschema').select('*').eq('gebruiker_id', user.id).eq('actief', true).order('code'),
      supabase.from('beginbalans').select('*').eq('gebruiker_id', user.id),
    ]);
    setRekeningen(rekRes.data || []);
    setBeginbalansen(bbRes.data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const getBeginbalans = (code: string) => beginbalansen.find((b) => b.rekeningcode === code);

  const startEdit = (code: string) => {
    const existing = getBeginbalans(code);
    setEditingCode(code);
    setForm({
      bedrag: existing ? String(existing.bedrag) : '',
      datum: existing ? existing.datum : new Date().toISOString().split('T')[0],
    });
    setError(null);
  };

  const cancel = () => { setEditingCode(null); setError(null); };

  const save = async () => {
    if (!form.bedrag || !form.datum) { setError('Bedrag en datum zijn verplicht.'); return; }
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const existing = getBeginbalans(editingCode!);
    const payload = {
      gebruiker_id: user.id,
      rekeningcode: editingCode!,
      bedrag: Number(form.bedrag),
      datum: form.datum,
    };

    if (existing) {
      const { error: err } = await supabase.from('beginbalans').update({ bedrag: payload.bedrag, datum: payload.datum }).eq('id', existing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('beginbalans').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await load();
    cancel();
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors" aria-label="Terug">
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Beginbalans</h2>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Voer per rekening een startsaldo en datum in. Dit wordt gebruikt als beginpunt voor de balansberekening.
      </p>

      {isLoading ? <Spinner /> : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          {rekeningen.map((r, idx) => {
            const bb = getBeginbalans(r.code);
            const isEditing = editingCode === r.code;
            return (
              <div key={r.code} style={{ borderBottom: idx < rekeningen.length - 1 ? '1px solid var(--border)' : undefined }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-label-sm font-mono font-semibold" style={{ color: 'var(--muted-foreground)' }}>{r.code}</span>
                      <span className="text-body-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.naam}</span>
                    </div>
                    {bb && !isEditing && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {formatEuro(bb.bedrag)} per {bb.datum}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => isEditing ? cancel() : startEdit(r.code)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
                    aria-label={`Bewerk beginbalans ${r.naam}`}
                  >
                    {isEditing ? <X size={15} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} /> : <Pencil size={15} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />}
                  </button>
                </div>
                {isEditing && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Bedrag (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.bedrag}
                          onChange={(e) => setForm({ ...form, bedrag: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Datum</label>
                        <input
                          type="date"
                          value={form.datum}
                          onChange={(e) => setForm({ ...form, datum: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg, #fff0f0)', color: 'var(--error, #ba1a1a)' }}>
                        <AlertCircle size={15} />
                        {error}
                      </div>
                    )}
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'var(--primary)' }}
                    >
                      <Check size={15} strokeWidth={2.5} />
                      {saving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Vaste Activa Panel ───────────────────────────────────────────────────────

function VasteActivaPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [activaRekeningen, setActivaRekeningen] = useState<Rekening[]>([]);
  const [vasteActiva, setVasteActiva] = useState<VasteActivum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { naam: '', rekeningcode: '', aanschafwaarde: '', aanschafdatum: '', afschrijvingsduur_jaren: '' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [rekRes, vaRes] = await Promise.all([
      supabase.from('rekeningschema').select('*').eq('gebruiker_id', user.id).eq('categorie', 'Activa').eq('actief', true).order('code'),
      supabase.from('vaste_activa').select('*').eq('gebruiker_id', user.id).order('aanschafdatum', { ascending: false }),
    ]);
    setActivaRekeningen(rekRes.data || []);
    setVasteActiva(vaRes.data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const startAdd = () => {
    setForm({ ...emptyForm, rekeningcode: activaRekeningen[0]?.code || '' });
    setShowForm(true);
    setEditingId(null);
    setError(null);
  };

  const startEdit = (va: VasteActivum) => {
    setForm({
      naam: va.naam,
      rekeningcode: va.rekeningcode,
      aanschafwaarde: String(va.aanschafwaarde),
      aanschafdatum: va.aanschafdatum,
      afschrijvingsduur_jaren: String(va.afschrijvingsduur_jaren),
    });
    setEditingId(va.id);
    setShowForm(true);
    setError(null);
  };

  const cancel = () => { setShowForm(false); setEditingId(null); setError(null); };

  const save = async () => {
    if (!form.naam.trim() || !form.rekeningcode || !form.aanschafwaarde || !form.aanschafdatum || !form.afschrijvingsduur_jaren) {
      setError('Alle velden zijn verplicht.');
      return;
    }
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      gebruiker_id: user.id,
      naam: form.naam.trim(),
      rekeningcode: form.rekeningcode,
      aanschafwaarde: Number(form.aanschafwaarde),
      aanschafdatum: form.aanschafdatum,
      afschrijvingsduur_jaren: Number(form.afschrijvingsduur_jaren),
    };

    if (editingId) {
      const { error: err } = await supabase.from('vaste_activa').update({
        naam: payload.naam,
        rekeningcode: payload.rekeningcode,
        aanschafwaarde: payload.aanschafwaarde,
        aanschafdatum: payload.aanschafdatum,
        afschrijvingsduur_jaren: payload.afschrijvingsduur_jaren,
      }).eq('id', editingId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('vaste_activa').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await load();
    cancel();
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors" aria-label="Terug">
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Vaste activa</h2>
        <button
          onClick={startAdd}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--primary)' }}
          disabled={showForm}
        >
          <Plus size={16} strokeWidth={2.5} />
          Toevoegen
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-label-md font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            {editingId ? 'Bewerk activum' : 'Nieuw vast activum'}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Naam *</label>
              <input
                type="text"
                value={form.naam}
                onChange={(e) => setForm({ ...form, naam: e.target.value })}
                placeholder="bijv. Laptop, Auto, Machine"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Gekoppelde rekening (Activa) *</label>
              <select
                value={form.rekeningcode}
                onChange={(e) => setForm({ ...form, rekeningcode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <option value="">Kies rekening...</option>
                {activaRekeningen.map((r) => (
                  <option key={r.code} value={r.code}>{r.code} — {r.naam}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Aanschafwaarde (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aanschafwaarde}
                  onChange={(e) => setForm({ ...form, aanschafwaarde: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Aanschafdatum *</label>
                <input
                  type="date"
                  value={form.aanschafdatum}
                  onChange={(e) => setForm({ ...form, aanschafdatum: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Afschrijvingsduur (jaren) *</label>
              <input
                type="number"
                min="1"
                value={form.afschrijvingsduur_jaren}
                onChange={(e) => setForm({ ...form, afschrijvingsduur_jaren: e.target.value })}
                placeholder="bijv. 5"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm mt-3 px-3 py-2 rounded-lg" style={{ background: 'var(--error-bg, #fff0f0)', color: 'var(--error, #ba1a1a)' }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--primary)' }}>
              <Check size={15} strokeWidth={2.5} />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--muted)', color: 'var(--foreground)' }}>
              <X size={15} strokeWidth={2.5} />
              Annuleren
            </button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : vasteActiva.length === 0 && !showForm ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Building2 size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Nog geen vaste activa geregistreerd.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
          {vasteActiva.map((va, idx) => (
            <div
              key={va.id}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: idx < vasteActiva.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-body-sm font-semibold" style={{ color: 'var(--foreground)' }}>{va.naam}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {va.rekeningcode} · {formatEuro(va.aanschafwaarde)} · {va.afschrijvingsduur_jaren} jr · {va.aanschafdatum}
                </p>
              </div>
              <button
                onClick={() => startEdit(va)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
                aria-label={`Bewerk ${va.naam}`}
              >
                <Pencil size={15} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Koppeling Panel ──────────────────────────────────────────────────────────

function KoppelingPanel({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors" aria-label="Terug">
          <ChevronLeft size={22} strokeWidth={2} style={{ color: 'var(--foreground)' }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Koppeling met boekhouder</h2>
      </div>
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Link2 size={40} strokeWidth={1.5} className="mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-body-md font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Komt in een volgende update</p>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          De koppeling met externe boekhoudpakketten wordt in een toekomstige versie toegevoegd.
        </p>
      </div>
    </div>
  );
}

// ─── Main BeheerContent ───────────────────────────────────────────────────────

const TILES = [
  {
    key: 'rekeningschema' as ActivePanel,
    icon: BookOpen,
    title: 'Rekeningschema',
    description: 'Rekeningen toevoegen en bewerken',
  },
  {
    key: 'beginbalans' as ActivePanel,
    icon: Scale,
    title: 'Beginbalans',
    description: 'Startsaldo per rekening instellen',
  },
  {
    key: 'vaste_activa' as ActivePanel,
    icon: Building2,
    title: 'Vaste activa',
    description: 'Activa registreren en afschrijven',
  },
  {
    key: 'koppeling' as ActivePanel,
    icon: Link2,
    title: 'Koppeling met boekhouder',
    description: 'Externe koppeling instellen',
  },
];

export default function BeheerContent() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('menu');

  const goBack = () => setActivePanel('menu');

  return (
    <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
      {activePanel === 'menu' && (
        <>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Beheer</h1>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>Beheer je administratie-instellingen</p>
          <div className="grid grid-cols-2 gap-3">
            {TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.key}
                  onClick={() => setActivePanel(tile.key)}
                  className="flex flex-col items-start p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Icon size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} />
                  </div>
                  <p className="text-body-sm font-semibold leading-tight mb-1" style={{ color: 'var(--foreground)' }}>
                    {tile.title}
                  </p>
                  <p className="text-xs leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                    {tile.description}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {activePanel === 'rekeningschema' && <RekeningschemaPanel onBack={goBack} />}
      {activePanel === 'beginbalans' && <BeginbalansPanel onBack={goBack} />}
      {activePanel === 'vaste_activa' && <VasteActivaPanel onBack={goBack} />}
      {activePanel === 'koppeling' && <KoppelingPanel onBack={goBack} />}
    </div>
  );
}
