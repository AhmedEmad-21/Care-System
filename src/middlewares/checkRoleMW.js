const { UnauthorizedError, ForbiddenError, BadRequestError } = require('../errors/appErrors');
const { ROLES } = require('../config/constants');

const PERMISSIONS = Object.freeze({
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    MANAGE_USERS: 'MANAGE_USERS',
    MANAGE_BOOKINGS: 'MANAGE_BOOKINGS',
    MANAGE_STAFF: 'MANAGE_STAFF',
    VIEW_BOOKINGS: 'VIEW_BOOKINGS',
});

const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.PATIENT]: new Set([]),
    [ROLES.DOCTOR]: new Set([PERMISSIONS.VIEW_BOOKINGS]),
    [ROLES.NURSE]: new Set([PERMISSIONS.VIEW_BOOKINGS]),
    [ROLES.STAFF]: new Set([PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_BOOKINGS, PERMISSIONS.VIEW_BOOKINGS]),
    [ROLES.ADMIN]: new Set(['*']),
});

const normalize = (value) => String(value || '').trim().toUpperCase();

const normalizeRoleKey = (role) => Object.values(ROLES).find((entry) => entry.toLowerCase() === String(role || '').trim().toLowerCase()) || role;

const hasPermission = (role, permission) => {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[normalizeRoleKey(role)];
    if (!permissions) return false;
    return permissions.has('*') || permissions.has(permission);
};

const checkRoleMW = (...required) => {
    const permissionsOrRoles = Array.isArray(required[0]) ? required[0] : required;
    if (!permissionsOrRoles || permissionsOrRoles.length === 0) {
        throw new BadRequestError('checkRoleMW requires at least one permission or role');
    }

    const requiredPermissions = permissionsOrRoles.map(normalize);

    return (req, res, next) => {
        const user = req.user;

        if (!user || !user.role) {
            return next(new UnauthorizedError('Unauthorized: user not authenticated or role missing'));
        }

        const normalizedRole = normalize(user.role);
        if (requiredPermissions.some((item) => item === normalizedRole)) {
            return next();
        }

        if (requiredPermissions.some((permission) => hasPermission(user.role, permission))) {
            return next();
        }

        return next(new ForbiddenError('Forbidden: insufficient permission'));
    };
};

module.exports = checkRoleMW;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
module.exports.hasPermission = hasPermission;
