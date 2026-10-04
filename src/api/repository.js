import { getSupabase } from './supabase.js';

const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

function assertTable(table) {
  if (!TABLE_NAME.test(table)) throw new Error('Invalid database resource.');
  return table;
}

export function repository(table) {
  const name = assertTable(table);
  return {
    async list({ select='*', workspaceId, filters={}, order='created_at.desc', limit=1000 }={}) {
      let query = getSupabase().from(name).select(select).limit(limit);
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      Object.entries(filters).forEach(([key,value]) => {
        if (value !== undefined && value !== null && value !== '') query = query.eq(key,value);
      });
      if (order) query = query.order(...order.split('.').slice(0,2));
      const { data,error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    async one({ select='*', workspaceId, filters={} }={}) {
      const rows = await this.list({select,workspaceId,filters,limit:1});
      return rows[0] ?? null;
    },
    async create(payload) {
      const { data,error } = await getSupabase().from(name).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id,payload) {
      const { data,error } = await getSupabase().from(name).update(payload).eq('id',id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await getSupabase().from(name).delete().eq('id',id);
      if (error) throw error;
    }
  };
}
