import { getSupabase } from '../api/supabase.js';
import { repository } from '../api/repository.js';

export const authService = {
  async session() {
    const { data,error } = await getSupabase().auth.getSession();
    if (error) throw error;
    return data.session ?? null;
  },

  async user() {
    const { data,error } = await getSupabase().auth.getUser();
    if (error) throw error;
    return data.user ?? null;
  },

  async profile(userId) {
    if (!userId) return null;
    return repository('app_profiles').one({
      filters:{ user_id:userId },
      select:'user_id,workspace_id,email,full_name,role,active,created_at,updated_at'
    });
  },

  async signIn(email,password) {
    const { data,error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    const profile = await this.profile(data.user?.id);
    if (!profile?.active) {
      await getSupabase().auth.signOut();
      throw new Error('Your account is inactive. Ask an administrator to enable it.');
    }
    return { session:data.session,user:data.user,profile };
  },

  async createFirstAdmin(email,password,fullName,workspaceId) {
    if (!workspaceId?.trim()) throw new Error('Workspace ID is required.');
    const { data,error } = await getSupabase().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options:{ data:{ workspace_id:workspaceId.trim(), full_name:fullName.trim() } }
    });
    if (error) throw error;
    if (!data.session) {
      return { session:null,user:data.user,profile:null,needsConfirmation:true };
    }
    const profile = await this.profile(data.user.id);
    return { session:data.session,user:data.user,profile };
  },

  async signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback) {
    return getSupabase().auth.onAuthStateChange(callback);
  }
};
