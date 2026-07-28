const DEFAULT_DOCTOR_PROFILE_IMAGE = process.env.DEFAULT_DOCTOR_PROFILE_IMAGE || 'https://placehold.co/256x256?text=Doctor';

const resolveProfileImage = (value) => {
  const image = String(value || '').trim();
  return image || DEFAULT_DOCTOR_PROFILE_IMAGE;
};

module.exports = {
  DEFAULT_DOCTOR_PROFILE_IMAGE,
  resolveProfileImage,
};