export const UNITS = ['pcs', 'box', 'set', 'ream', 'pack', 'unit', 'bottle', 'meter', 'kg'];
export const CONDITIONS = ['New', 'Good', 'Fair', 'Needs Repair', 'Retired'];
export const LOCATIONS = [
  'Computer Lab 1',
  'Computer Lab 2',
  'Science Laboratory',
  'AV Room',
  'Supply Room',
  'Storage Area',
  'Gym Storage',
  'Faculty Room',
  'Library',
  'Administrative Office',
];

export const REPORT_TYPES = [
  { value: 'inventory', label: 'Complete inventory', description: 'All active items and stock levels' },
  { value: 'available', label: 'Available stock', description: 'Items with quantity greater than zero' },
  { value: 'low', label: 'Low-stock report', description: 'Items at or below minimum level' },
  { value: 'out', label: 'Out-of-stock report', description: 'Items with zero quantity' },
  { value: 'stock-in', label: 'Stock-in report', description: 'Incoming stock transactions' },
  { value: 'stock-out', label: 'Stock-out report', description: 'Outgoing stock transactions' },
  { value: 'borrows', label: 'Borrowed & returned', description: 'Borrowing history and status' },
  { value: 'transactions', label: 'Transaction history', description: 'All stock movements' },
];

export const TRANSACTION_TYPES = ['Stock In', 'Stock Out', 'Borrowed', 'Returned', 'Adjustment'];
