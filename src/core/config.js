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
  // Only relevant for Vite builds; the static legacy app configures Supabase itself.
  if ((!config.supabaseUrl || !config.supabaseAnonKey) && config.environment === 'development') {
    console.info('[Event Media OS] v5 Supabase client not configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
}
