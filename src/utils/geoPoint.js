const { BadRequestError } = require('../errors/appErrors');

const normalizeGeoPoint = (location, fieldName = 'location') => {
  if (!location) return null;

  if (
    location.type !== 'Point' ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    throw new BadRequestError(`${fieldName} must be a GeoJSON Point with [longitude, latitude]`);
  }

  const coordinates = location.coordinates.map(Number);
  if (coordinates.some((entry) => !Number.isFinite(entry))) {
    throw new BadRequestError(`${fieldName} contains invalid coordinates`);
  }

  return { type: 'Point', coordinates };
};

module.exports = { normalizeGeoPoint };