/**
 * Central permission matrix. The same matrix is mirrored on the client for
 * navigation visibility, but every mutation is enforced here on the server.
 */
export const PERMISSIONS = {
  'dashboard:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'inventory:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'inventory:create': ['Administrator', 'Inventory Staff'],
  'inventory:update': ['Administrator', 'Inventory Staff'],
  'inventory:archive': ['Administrator'],
  'transactions:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'transactions:create': ['Administrator', 'Inventory Staff'],
  'transactions:adjust': ['Administrator'],
  'borrows:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'borrows:create': ['Administrator', 'Inventory Staff'],
  'borrows:update': ['Administrator', 'Inventory Staff'],
  'categories:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'categories:manage': ['Administrator'],
  'reports:read': ['Administrator', 'Inventory Staff', 'Viewer'],
  'users:read': ['Administrator'],
  'users:manage': ['Administrator'],
  'logs:read': ['Administrator'],
};

export const ROLE_DESCRIPTIONS = {
  Administrator: 'Full access: users, roles, inventory, categories, logs and reports.',
  'Inventory Staff': 'Manage inventory items, stock transactions and borrowing records.',
  Viewer: 'Read-only access to the dashboard, inventory and reports.',
};

export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return Boolean(allowed && allowed.includes(role));
}
