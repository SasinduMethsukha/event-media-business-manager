// Central runtime configuration.
// Browser-safe values only. NEVER place a Supabase service-role key here.
export const config = Object.freeze({
  appName: 'Event Media OS',
  apiBaseUrl: import.meta?.env?.VITE_API_BASE_URL || '/api',
  supabaseUrl: import.meta?.env?.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta?.env?.VITE_SUPABASE_ANON_KEY || '',
  environment: import.meta?.env?.MODE || 'production'
});

export function assertClientConfig() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('[Event Media OS] Supabase client configuration is missing.');
  }
}
