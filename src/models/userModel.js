const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/appConfig');

const userRoles = ['Patient', 'Doctor', 'Nurse', 'Staff', 'Admin'];
const accountStatuses = ['active', 'suspended'];
const vettingStatuses = ['pending', 'approved', 'rejected'];

const geoPointSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            required: false,
            validate: {
                validator(value) {
                    return value == null || (Array.isArray(value) && value.length === 2);
                },
                message: 'coordinates must contain [longitude, latitude]',
            },
        },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: userRoles,
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
            required: true,
            minlength: 8,
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        profileImage: {
            type: String,
            default: null,
            trim: true,
        },
        location: {
            type: geoPointSchema,
            default: null,
        },
        accountStatus: {
            type: String,
            enum: accountStatuses,
            default: 'active',
        },
        vettingStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved' 
        },
        createdByAdminID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        resetPasswordTokenHash: {
            type: String,
            default: null,
        },
        resetPasswordExpiresAt: {
            type: Date,
            default: null,
        },
        resetPasswordAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastOtpSentAt: {
            type: Date,
            default: null,
        },
        resetPasswordVerifiedAt: {
            type: Date,
            default: null,
        },
        aiAnalysisAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastAiAnalysisDate: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ role: 1, vettingStatus: 1 });
userSchema.index({ vettingStatus: 1, createdAt: -1 });
userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function hashPassword() {
    if (!this.isModified('passwordHash')) {
        return;
    }

    this.passwordHash = await bcrypt.hash(this.passwordHash, config.securityConfig.bcryptSaltRounds);
});

userSchema.methods.comparePassword = function comparePassword(password) {
    return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);