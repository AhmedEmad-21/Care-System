const normalizeResponseTimestamps = (value, maybeTimezoneOrSeen, maybeSeen) => {
  const activeStack = maybeSeen instanceof Set
    ? maybeSeen
    : maybeTimezoneOrSeen instanceof Set
      ? maybeTimezoneOrSeen
      : new Set();

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
    return value.map((entry) => normalizeResponseTimestamps(entry, activeStack));
  }

  if (typeof value === 'object') {
    if (activeStack.has(value)) {
      return '[Circular]';
    }
    activeStack.add(value);

    // Preserve special serialized objects like ObjectId where a simple string is safer.
    if (value._bsontype === 'ObjectId' && typeof value.toString === 'function') {
      activeStack.delete(value);
      return value.toString();
    }

    // Convert Mongoose Document to plain object if needed
    const plainObj = typeof value.toObject === 'function' ? value.toObject() : value;

    const normalized = {};

    for (const [key, nestedValue] of Object.entries(plainObj)) {
      normalized[key] = normalizeResponseTimestamps(nestedValue, activeStack);
    }

    activeStack.delete(value);
    return normalized;
  }

  return value;
};

module.exports = {
  normalizeResponseTimestamps,
};
