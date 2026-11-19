import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$app/env/private';

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return (client = null);
  return (client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }));
}

// Store a salted hash instead of the raw IP.
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${SUPABASE_SERVICE_ROLE_KEY}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function logChat(entry: {
  ipHash: string;
  question: string;
  answer: string;
  model?: string;
  status?: 'ok' | 'error';
}): Promise<void> {
  const db = getClient();
  if (!db) return;
  const { error } = await db.from('chat_logs').insert({
    ip_hash: entry.ipHash,
    question: entry.question,
    answer: entry.answer,
    model: entry.model ?? null,
    status: entry.status ?? 'ok'
  });
  if (error) console.error('Failed to write chat log:', error.message);
}
