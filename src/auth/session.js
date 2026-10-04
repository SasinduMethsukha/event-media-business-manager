import { authService } from './auth.service.js';
import { store } from '../state/store.js';

export async function hydrateAuth() {
  const session = await authService.session();
  if (!session?.user) {
    store.patch({user:null,profile:null,workspace:null,role:null});
    return null;
  }
  const profile = await authService.profile(session.user.id);
  if (!profile?.active) {
    await authService.signOut().catch(()=>{});
    store.patch({user:null,profile:null,workspace:null,role:null});
    return null;
  }
  store.patch({
    user:session.user,
    profile,
    workspace:profile.workspace_id,
    role:profile.role
  });
  return {session,profile};
}
