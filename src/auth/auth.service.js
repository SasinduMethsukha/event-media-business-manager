import { getSupabase } from '../api/supabase.js';

export const authService = {
  async signIn(email, password) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  },

  async currentUser() {
    const { data, error } = await getSupabase().auth.getUser();
    if (error) throw error;
    return data.user;
  },

  onAuthStateChange(callback) {
    return getSupabase().auth.onAuthStateChange(callback);
  }
};
