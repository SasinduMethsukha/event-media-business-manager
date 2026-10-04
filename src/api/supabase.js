import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config.js';

let client;

export function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase client is not configured.');
  }
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: { 'x-client-info': 'event-media-os-v5' }
      }
    });
  }
  return client;
}

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
