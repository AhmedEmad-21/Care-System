const ROLES = Object.freeze({
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  STAFF: 'Staff',
  ADMIN: 'Admin',
});

const BOOKING_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
});

module.exports = {
  ROLES,
  BOOKING_STATUSES,
};