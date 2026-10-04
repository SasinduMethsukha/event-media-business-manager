import { assertClientConfig } from './config.js';
import { authService } from '../auth/auth.service.js';
import { restoreAuth, signInFromUI, signOutFromUI, createFirstAdminFromUI } from '../auth/ui-controller.js';

export async function boot() {
  assertClientConfig();

  // These global functions preserve the existing HTML contract while the
  // implementation moves into modules.
  window.profileSignIn = signInFromUI;
  window.profileLogout = signOutFromUI;
  window.profileCreateAdmin = createFirstAdminFromUI;

  await restoreAuth();

  authService.onAuthStateChange(async (_event, session) => {
    if (!session) {
      window.dispatchEvent(new CustomEvent('app:auth',{detail:{session:null}}));
      return;
    }
    await restoreAuth();
    window.dispatchEvent(new CustomEvent('app:auth',{detail:{session}}));
  });

  document.documentElement.dataset.appReady='true';
}
