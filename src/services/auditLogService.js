const AuditLog = require('../models/auditLogModel');

const logAuditEvent = async ({ actorId = null, actorRole = null, action, entityType, entityId = null, before = null, after = null, meta = null }) => {
  return AuditLog.create({
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    before,
    after,
    meta,
  });
};

const listAuditLogs = async ({ limit = 100, entityType = null } = {}) => {
  const query = {};
  if (entityType) {
    query.entityType = entityType;
  }

  return AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .lean();
};

module.exports = {
  logAuditEvent,
  listAuditLogs,
};