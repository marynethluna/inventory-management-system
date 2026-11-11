import { Badge } from './common';

const TYPE_TONES = {
  'Stock In': 'success',
  'Stock Out': 'warning',
  Borrowed: 'info',
  Returned: 'success',
  Adjustment: 'neutral',
};

export function TransactionTypeBadge({ type }) {
  return <Badge tone={TYPE_TONES[type] || 'neutral'}>{type}</Badge>;
}

const BORROW_TONES = {
  Borrowed: 'info',
  Overdue: 'danger',
  Returned: 'success',
};

export function BorrowStatusBadge({ status }) {
  return <Badge tone={BORROW_TONES[status] || 'neutral'}>{status}</Badge>;
}

export function ConditionBadge({ condition }) {
  const tone = condition === 'New' ? 'success' : condition === 'Good' ? 'info' : condition === 'Fair' ? 'warning' : condition === 'Needs Repair' ? 'danger' : 'neutral';
  return <Badge tone={tone} dot={false}>{condition}</Badge>;
}
