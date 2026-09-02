const mongoose = require('mongoose');

const twoFactorEntrySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    method: {
      type: String,
      enum: ['email', 'totp'],
      default: 'email',
    },
    secret: {
      type: String,
      default: '',
    },
    // Email OTP code (stored for verification)
    emailCode: {
      type: String,
      default: '',
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TwoFactorEntry', twoFactorEntrySchema);
