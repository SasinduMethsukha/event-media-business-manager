import { getSupabase } from '../api/supabase.js';
export const reportsService = {
  async audit(limit = 100) {
    const { data, error } = await getSupabase()
      .from('audit_log').select('*').order('created_at', { ascending:false }).limit(limit);
    if (error) throw error;
    return data || [];
  }
};
