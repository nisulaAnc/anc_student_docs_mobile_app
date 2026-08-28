const mongoose = require('mongoose');

const cfTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  cf_number: { type: String, required: true },
  student_name: { type: String, required: true },
  student_email: { type: String, required: true },
  university: { type: String, enum: ['ANC', 'UWL'], default: 'ANC' },
  counsellor_name: { type: String, required: true },
  counsellor_email: { type: String, required: true },
  status: { type: String, enum: ['pending', 'used', 'expired'], default: 'pending' },
  otp: { type: String, default: '' },
  otp_time: { type: Date },
  phase: {
    type: String,
    enum: ['otp_request', 'otp_sent', 'otp_verified', 'program_selected', 'done'],
    default: 'otp_request',
  },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CfToken', cfTokenSchema);
