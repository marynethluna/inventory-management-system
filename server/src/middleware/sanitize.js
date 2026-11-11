/**
 * Strips MongoDB operator keys ($where, $ne, ...) and dotted keys from
 * user-controlled input. This is a defence-in-depth layer against NoSQL
 * injection; all inputs are additionally validated with express-validator.
 */
function sanitizeValue(value, depth = 0) {
  if (depth > 6) return undefined;
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, depth + 1));
  if (value && typeof value === 'object') {
    if (value instanceof Date || value instanceof Object && value.constructor?.name === 'ObjectId') return value;
    const clean = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      const cleaned = sanitizeValue(value[key], depth + 1);
      if (cleaned !== undefined) clean[key] = cleaned;
    }
    return clean;
  }
  if (typeof value === 'string') return value.trim();
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) delete req.query[key];
      else req.query[key] = sanitizeValue(req.query[key]);
    }
  }
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      if (typeof req.params[key] === 'string') req.params[key] = req.params[key].trim();
    }
  }
  next();
}
