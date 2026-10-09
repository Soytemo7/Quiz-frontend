import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { supabase } from './supabase';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionInput = { question: string; options: string[]; correctOption: number; explanation: string; category: string; difficulty: Difficulty; source: string; active: boolean };
export type Question = QuestionInput & { id: string; _id?: string; createdAt: string; updatedAt: string };
export type ApiError = { error?: { message?: string; code?: string; details?: Array<{ path: string; message: string }> } };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Tu sesión terminó. Inicia sesión de nuevo.');
  const response = await fetch(`${PUBLIC_API_BASE_URL.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init.headers }
  });
  const payload = await response.json().catch(() => ({})) as ApiError & T;
  if (!response.ok) throw new Error(payload.error?.message ?? `Error HTTP ${response.status}`);
  return payload as T;
}
