import { getSupabase } from './supabase.js';

function safeTable(table) {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error('Invalid table name.');
  return table;
}

export function repository(table) {
  const name = safeTable(table);
  return {
    async list({ workspaceId, select = '*', limit = 500 } = {}) {
      let query = getSupabase().from(name).select(select).limit(limit);
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await getSupabase().from(name).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data, error } = await getSupabase().from(name).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await getSupabase().from(name).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await getSupabase().from(name).delete().eq('id', id);
      if (error) throw error;
    }
  };
}
