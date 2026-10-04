const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  manager: [
    'dashboard.read','clients.read','clients.write','events.read','events.write',
    'invoices.read','invoices.write','payments.read','payments.write',
    'expenses.read','expenses.write','reports.read','equipment.read','equipment.write',
    'crew.read','crew.write'
  ],
  employee: [
    'dashboard.read','clients.read','events.read','events.write',
    'invoices.read','payments.read','equipment.read','crew.read'
  ]
});

export function can(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function assertCan(role, permission) {
  if (!can(role, permission)) {
    const error = new Error('You do not have permission to perform this action.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}

export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}
