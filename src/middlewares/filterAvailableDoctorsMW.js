const config = require('../config/appConfig');
const { BadRequestError } = require('../errors/appErrors');

const parseCoordinatePair = (value) => {
    if (value == null) return null;

    if (Array.isArray(value) && value.length === 2) {
        const [longitude, latitude] = value.map(Number);
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            return [longitude, latitude];
        }
        return null;
    }

    if (typeof value === 'string') {
        const parts = value.split(',').map((entry) => Number(entry.trim()));
        if (parts.length === 2 && parts.every(Number.isFinite)) {
            return parts;
        }
    }

    return null;
};

const extractLocation = (req) => {
    const bodyLocation = req.body?.requestLocation?.coordinates;
    if (Array.isArray(bodyLocation)) {
        return parseCoordinatePair(bodyLocation);
    }

    const queryLocation = req.query?.coordinates || req.query?.location;
    return parseCoordinatePair(queryLocation);
};

const filterAvailableDoctorsMW = (req, res, next) => {
    const today = new Date().getDay();
    const coordinates = extractLocation(req);

    req.filterCriteria = {
        ...(req.filterCriteria || {}),
        isAvailable: true,
        offDays: { $ne: today },
    };

    if (coordinates) {
        req.filterCriteria.location = {
            $nearSphere: {
                $geometry: {
                    type: 'Point',
                    coordinates,
                },
                $maxDistance: Number(req.query?.maxDistanceMeters || config.securityConfig.geoSearchRadiusMeters),
            },
        };
        req.requestLocation = {
            type: 'Point',
            coordinates,
        };
    } else if (req.query?.coordinates || req.body?.requestLocation) {
        return next(new BadRequestError('Invalid geo coordinates payload'));
    }

    next();
};

module.exports = filterAvailableDoctorsMW;