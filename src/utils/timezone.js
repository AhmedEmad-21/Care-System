const normalizeResponseTimestamps = (value, maybeTimezoneOrSeen, maybeSeen) => {
  const seen = maybeSeen instanceof WeakSet
    ? maybeSeen
    : maybeTimezoneOrSeen instanceof WeakSet
      ? maybeTimezoneOrSeen
      : new WeakSet();

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value == null) {
    return value;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('hex');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeResponseTimestamps(entry, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    // Preserve special serialized objects like ObjectId where a simple string is safer.
    if (value._bsontype === 'ObjectId' && typeof value.toString === 'function') {
      return value.toString();
    }

    const normalized = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = normalizeResponseTimestamps(nestedValue, seen);
    }

    return normalized;
  }

  return value;
};

module.exports = {
  normalizeResponseTimestamps,
};