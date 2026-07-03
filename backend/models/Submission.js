const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  // Unique token — prevents duplicate submissions at the DB level
  token: { type: String, required: true, unique: true, index: true },
  cf_number: { type: String, required: true },
  student_name: { type: String, required: true },
  student_email: { type: String, required: true },
  counsellor_name: { type: String },
  program_level: { type: String },
  degree_description: { type: String },
  product_code: { type: String },
  documents: [
    {
      label: String,
      cloudinary_url: { type: String, default: '' },
      file_name: String,
      public_id: String,
      uploaded_at: { type: Date, default: Date.now },
    },
  ],
  agreement_url: { type: String, default: '' },
  agreement_public_id: { type: String, default: '' },
  submitted_at: { type: Date, default: Date.now },
  synced_to_sheet: { type: Boolean, default: false },
  // Indicates document submission status: 'complete' = all required docs uploaded, 'partial' = some missing
  status: {
    type: String,
    enum: ['partial', 'complete'],
    default: 'partial',
  },
  total_required_docs: { type: Number, default: 0 },
});

module.exports = mongoose.model('Submission', submissionSchema);