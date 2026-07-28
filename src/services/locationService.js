const User = require('../models/userModel');
const Doctor = require('../models/doctorModel');
const Nurse = require('../models/nurseModel');
const { BadRequestError, NotFoundError } = require('../errors/appErrors');

const normalizeGeoPoint = (location) => {
  if (!location || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    throw new BadRequestError('location must be a GeoJSON Point with [longitude, latitude]');
  }
  const coords = location.coordinates.map(Number);
  if (coords.some((c) => !Number.isFinite(c))) throw new BadRequestError('Invalid coordinate values');
  return { type: 'Point', coordinates: coords };
};

const updateUserLocation = async (userId, location) => {
  const geo = normalizeGeoPoint(location);
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  user.location = geo;
  await user.save();
  return user;
};

const updateProviderLocation = async (providerType, providerId, location) => {
  const geo = normalizeGeoPoint(location);
  if (providerType === 'doctor') {
    const doc = await Doctor.findById(providerId);
    if (!doc) throw new NotFoundError('Doctor not found');
    doc.location = geo;
    await doc.save();
    return doc;
  }

  if (providerType === 'nurse') {
    const nurse = await Nurse.findById(providerId);
    if (!nurse) throw new NotFoundError('Nurse not found');
    nurse.location = geo;
    await nurse.save();
    return nurse;
  }

  throw new BadRequestError('Unknown providerType');
};

module.exports = {
  updateUserLocation,
  updateProviderLocation,
};
