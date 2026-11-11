/** Serialization helpers keep API responses stable and free of internal fields. */

export function toItemDTO(item) {
  if (!item) return null;
  const category = item.category && typeof item.category === 'object' ? item.category : null;
  return {
    id: item._id.toString(),
    itemCode: item.itemCode,
    name: item.name,
    category: category ? category.name : 'Uncategorized',
    categoryId: category ? category._id.toString() : item.category?.toString?.() || null,
    description: item.description || '',
    quantity: item.quantity,
    unit: item.unit,
    minimumStock: item.minimumStock,
    location: item.location || '',
    condition: item.condition,
    status: item.quantity === 0 ? 'Out of Stock' : item.quantity <= item.minimumStock ? 'Low Stock' : 'In Stock',
    isActive: item.isActive,
    dateAdded: item.createdAt,
    lastUpdated: item.updatedAt,
  };
}

export function toTransactionDTO(txn) {
  if (!txn) return null;
  const item = txn.item && typeof txn.item === 'object' ? txn.item : null;
  const user = txn.recordedBy && typeof txn.recordedBy === 'object' ? txn.recordedBy : null;
  return {
    id: txn._id.toString(),
    reference: txn.reference,
    type: txn.type,
    itemId: item ? item._id.toString() : txn.item?.toString?.() || null,
    itemName: item ? item.name : 'Deleted item',
    itemCode: item ? item.itemCode : '',
    quantity: txn.quantity,
    balanceAfter: txn.balanceAfter,
    date: txn.date,
    supplier: txn.supplier || '',
    reason: txn.reason || '',
    remarks: txn.remarks || '',
    recordedBy: user ? { id: user._id.toString(), name: user.name, username: user.username } : null,
  };
}

export function toBorrowDTO(record) {
  if (!record) return null;
  const item = record.item && typeof record.item === 'object' ? record.item : null;
  const user = record.recordedBy && typeof record.recordedBy === 'object' ? record.recordedBy : null;
  const returnedBy = record.returnedBy && typeof record.returnedBy === 'object' ? record.returnedBy : null;
  return {
    id: record._id.toString(),
    reference: record.reference,
    borrowerName: record.borrowerName,
    borrowerIdNumber: record.borrowerIdNumber,
    itemId: item ? item._id.toString() : record.item?.toString?.() || null,
    itemName: item ? item.name : 'Deleted item',
    itemCode: item ? item.itemCode : '',
    unit: item ? item.unit : '',
    quantity: record.quantity,
    dateBorrowed: record.dateBorrowed,
    expectedReturnDate: record.expectedReturnDate,
    actualReturnDate: record.actualReturnDate,
    status: record.status,
    displayStatus:
      record.status === 'Returned'
        ? 'Returned'
        : record.expectedReturnDate && new Date(record.expectedReturnDate).getTime() < Date.now()
          ? 'Overdue'
          : 'Borrowed',
    remarks: record.remarks || '',
    recordedBy: user ? { id: user._id.toString(), name: user.name } : null,
    returnedBy: returnedBy ? { id: returnedBy._id.toString(), name: returnedBy.name } : null,
  };
}

export function toCategoryDTO(category, stats = {}) {
  if (!category) return null;
  return {
    id: category._id.toString(),
    name: category.name,
    description: category.description || '',
    itemCount: stats.itemCount ?? 0,
    totalQuantity: stats.totalQuantity ?? 0,
    createdAt: category.createdAt,
  };
}

export function toUserDTO(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email || '',
    role: user.role,
    isActive: user.isActive,
    initials: user.initials,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export function toLogDTO(log) {
  if (!log) return null;
  return {
    id: log._id.toString(),
    actorName: log.actorName,
    actorUsername: log.actorUsername,
    actorRole: log.actorRole,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    entityLabel: log.entityLabel,
    details: log.details,
    createdAt: log.createdAt,
  };
}
