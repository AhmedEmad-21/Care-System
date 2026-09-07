const GEO_MAX_DISTANCE_METERS = 35000;
const USER_POPULATE_FIELDS = 'name email phoneNumber profileImage address location';
const TITLE_RE = /^(?:دكتور(?:ة)?|د|dr|doctor|ممرضة|ممرض|م)$/i;

function normalizeArabic(text) {
  return String(text)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toFlexibleArabicRegex(token) {
  return escapeRegex(token)
    .replace(/ا/g, '[اأإآٱ]')
    .replace(/ي/g, '[يىئ]')
    .replace(/ه/g, '[هة]')
    .replace(/و/g, '[وؤ]');
}

function buildNameFilter(rawName) {
  const value = Array.isArray(rawName) ? rawName[0] : rawName;
  if (value == null || String(value).trim() === '') {
    return null;
  }

  const tokens = normalizeArabic(value)
    .split(' ')
    .filter((token) => token && !TITLE_RE.test(token));

  if (tokens.length === 0) {
    return null;
  }

  return {
    $and: tokens.map((token) => ({
      name: { $regex: toFlexibleArabicRegex(token), $options: 'i' }
    }))
  };
}

function withOptionalDateFilter(filter, date) {
  if (!date) return filter;
  return {
    ...filter,
    offDays: { $ne: new Date(date).getDay() }
  };
}

async function findByNameWithOptionalGeo(Model, filter, { lat, long } = {}) {
  if (lat && long) {
    return Model.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(long), parseFloat(lat)] },
          distanceField: 'dist.calculated',
          spherical: true,
          maxDistance: GEO_MAX_DISTANCE_METERS,
          query: filter
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          'userId.passwordHash': 0,
          'userId.resetPasswordTokenHash': 0
        }
      }
    ]);
  }

  return Model.find(filter).populate('userId', USER_POPULATE_FIELDS).lean();
}

module.exports = {
  GEO_MAX_DISTANCE_METERS,
  buildNameFilter,
  findByNameWithOptionalGeo,
  normalizeArabic,
  withOptionalDateFilter
};
