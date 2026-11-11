/**
 * Recursively removes MongoDB operators, dotted paths and prototype-related
 * keys from untrusted JSON/query input. String values are intentionally not
 * trimmed here: passwords are opaque secrets and must be preserved exactly.
 */
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function sanitizeValue(value, depth = 0) {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    const clean = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) continue;
      const cleaned = sanitizeValue(value[key], depth + 1);
      if (cleaned !== undefined) clean[key] = cleaned;
    }
    return clean;
  }
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);

  // Express 4 exposes req.query through a getter, so assigning individual keys
  // can be lost on the next access. Install a sanitized own property instead.
  const cleanQuery = sanitizeValue(req.query || {});
  Object.defineProperty(req, 'query', {
    value: cleanQuery && typeof cleanQuery === 'object' ? cleanQuery : {},
    writable: true,
    configurable: true,
    enumerable: true,
  });

  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      if (BLOCKED_KEYS.has(key)) delete req.params[key];
    }
  }
  next();
}
