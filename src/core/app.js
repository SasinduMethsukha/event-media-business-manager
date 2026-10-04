import { assertClientConfig } from './config.js';
import { authService } from '../auth/auth.service.js';
import { store } from '../state/store.js';

export async function boot() {
  assertClientConfig();

  const session = await authService.currentUser().catch(() => null);
  store.patch({ user: session });

  authService.onAuthStateChange((_event, session) => {
    store.patch({ user: session });
    window.dispatchEvent(new CustomEvent('app:auth', { detail: { session } }));
  });

  document.documentElement.dataset.appReady = 'true';
}
