// Central runtime configuration. Browser-safe values only.
// NEVER place a Supabase service-role/secret key here.

const env = import.meta.env || {};
const storedUrl = typeof localStorage !== 'undefined' ? (localStorage.getItem('invoice:supabase:url') || localStorage.getItem('invoice:supabase:sbUrl') || '') : '';
const storedKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('invoice:supabase:key') || localStorage.getItem('invoice:supabase:sbKey') || '') : '';
const publicConfig = typeof window !== 'undefined' ? (window.EVENTMEDIA_PUBLIC_CONFIG || {}) : {};

export const config = Object.freeze({
  appName: 'Event Media OS',
  apiBaseUrl: env.VITE_API_BASE_URL || '/api',
  supabaseUrl: env.VITE_SUPABASE_URL || publicConfig.supabaseUrl || storedUrl,
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || publicConfig.anonKey || storedKey,
  environment: env.MODE || 'production'
});

export function assertClientConfig() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('[Event Media OS] Supabase client configuration is missing.');
    return false;
  }
  return true;
}
