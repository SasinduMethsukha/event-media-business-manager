import { assertClientConfig, config } from './config.js';
import { store } from '../state/store.js';

export async function boot() {
  assertClientConfig();

  // The v5 layer only talks to Supabase when it has been configured through
  // Vite env vars. Importing the auth service eagerly pulled supabase-js from
  // a CDN on every page load (and logged network errors) even though the
  // running app still uses the legacy client, so it is loaded on demand.
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const { authService } = await import('../auth/auth.service.js');
    const session = await authService.currentUser().catch(() => null);
    store.patch({ user: session });

    authService.onAuthStateChange((_event, session) => {
      store.patch({ user: session });
      window.dispatchEvent(new CustomEvent('app:auth', { detail: { session } }));
    });
  }

  document.documentElement.dataset.appReady = 'true';
}
