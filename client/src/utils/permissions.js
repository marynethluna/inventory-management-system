/**
 * Client-side mirror of the server permission matrix (server/src/utils/permissions.js).
 * Used only to decide what to render — the API independently enforces every rule.
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

export const ROLE_LABELS = {
  Administrator: 'Administrator',
  'Inventory Staff': 'Inventory Staff',
  Viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS = {
  Administrator: 'Full access to users, roles, inventory, categories, reports and activity logs.',
  'Inventory Staff': 'Manage inventory items, stock transactions and borrowing records.',
  Viewer: 'Read-only access to the dashboard, inventory and reports.',
};

export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return Boolean(role && allowed && allowed.includes(role));
}

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', permission: 'dashboard:read', icon: 'dashboard', group: 'Overview' },
  { to: '/inventory', label: 'Inventory', permission: 'inventory:read', icon: 'inventory', group: 'Inventory' },
  { to: '/transactions', label: 'Stock Transactions', permission: 'transactions:read', icon: 'transactions', group: 'Inventory' },
  { to: '/borrowing', label: 'Borrowing & Returns', permission: 'borrows:read', icon: 'borrowing', group: 'Inventory' },
  { to: '/categories', label: 'Categories', permission: 'categories:read', icon: 'categories', group: 'Inventory' },
  { to: '/reports', label: 'Reports', permission: 'reports:read', icon: 'reports', group: 'Insights' },
  { to: '/users', label: 'User Management', permission: 'users:read', icon: 'users', group: 'Administration' },
  { to: '/logs', label: 'Activity Logs', permission: 'logs:read', icon: 'logs', group: 'Administration' },
  { to: '/settings', label: 'Settings', permission: 'dashboard:read', icon: 'settings', group: 'Account' },
];

export const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: 'Inventory overview and recent activity' },
  '/inventory': { title: 'Inventory', subtitle: 'School supplies, equipment and laboratory materials' },
  '/transactions': { title: 'Stock Transactions', subtitle: 'Incoming and outgoing stock records' },
  '/borrowing': { title: 'Borrowing & Returns', subtitle: 'Track borrowed school equipment' },
  '/categories': { title: 'Categories', subtitle: 'Organize inventory into logical groups' },
  '/reports': { title: 'Reports', subtitle: 'Generate, print and export inventory reports' },
  '/users': { title: 'User Management', subtitle: 'Accounts, roles and access control' },
  '/logs': { title: 'Activity Logs', subtitle: 'Audit trail of important system actions' },
  '/settings': { title: 'Settings', subtitle: 'Your profile, password and preferences' },
};
