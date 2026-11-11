export function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
  let page = Number.parseInt(query.page, 10);
  let limit = Number.parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export function parseDateRange(query) {
  const from = query.from ? new Date(`${query.from}T00:00:00`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

export function buildDateFilter(from, to, field = 'date') {
  const filter = {};
  if (from) filter[field] = { ...(filter[field] || {}), $gte: from };
  if (to) filter[field] = { ...(filter[field] || {}), $lte: to };
  return filter;
}

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
