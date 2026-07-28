const parseDuration = (value, fallbackMs) => {
  if (value == null || value === '') return fallbackMs;

  const raw = String(value).trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!match) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) ? asNumber * 1000 : fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2] || 'm';

  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.m);
};

module.exports = parseDuration;
