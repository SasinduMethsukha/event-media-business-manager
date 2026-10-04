import { describe,it,expect } from 'vitest';
import { can,permissionsFor } from './authorization.js';

describe('authorization',()=>{
  it('gives admins full access',()=>expect(can('admin','anything')).toBe(true));
  it('limits employees to read-safe permissions',()=>{
    expect(can('employee','dashboard.read')).toBe(true);
    expect(can('employee','clients.write')).toBe(false);
    expect(can('employee','payments.write')).toBe(false);
  });
  it('returns no permissions for unknown roles',()=>expect(permissionsFor('unknown')).toEqual([]));
});
