import { createClient } from '@/lib/supabase/client';

export interface Profiel {
  id: string;
  naam: string | null;
  email: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  updatedAt: string | null;
  heeftZakelijkeRekening: boolean;
}

function getAvatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const supabase = createClient();
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function getProfiel(userId: string): Promise<Profiel | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profielen')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getProfiel error:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    naam: data.naam,
    email: data.email,
    avatarPath: data.avatar_path,
    avatarUrl: getAvatarPublicUrl(data.avatar_path),
    updatedAt: data.updated_at,
    heeftZakelijkeRekening: data.heeft_zakelijke_rekening ?? false,
  };
}

export async function upsertProfiel(
  userId: string,
  updates: {
    naam?: string;
    email?: string;
    avatarPath?: string | null;
    heeftZakelijkeRekening?: boolean;
  }
): Promise<Profiel | null> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (updates.naam !== undefined) payload.naam = updates.naam;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.avatarPath !== undefined) payload.avatar_path = updates.avatarPath;
  if (updates.heeftZakelijkeRekening !== undefined) payload.heeft_zakelijke_rekening = updates.heeftZakelijkeRekening;

  const { data, error } = await supabase
    .from('profielen')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('upsertProfiel error:', error.message);
    return null;
  }

  return {
    id: data.id,
    naam: data.naam,
    email: data.email,
    avatarPath: data.avatar_path,
    avatarUrl: getAvatarPublicUrl(data.avatar_path),
    updatedAt: data.updated_at,
    heeftZakelijkeRekening: data.heeft_zakelijke_rekening ?? false,
  };
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '0' });

  if (error) {
    console.error('uploadAvatar error:', error.message);
    return null;
  }
  return path;
}

export async function deleteAvatar(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from('avatars').remove([path]);
}
