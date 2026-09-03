const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const StudentToken = require('../models/StudentToken');
const { buildUploadFileName } = require('../utils/uploadNaming');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: async (req, file) => {
      const baseFolder = process.env.CLOUDINARY_FOLDER || 'student_dms';
      let docName = 'Other';
      if (file.fieldname === 'agreement') {
        docName = 'Agreement';
      } else if (file.fieldname.startsWith('doc_')) {
        try {
          const docLabels = JSON.parse(req.body.doc_labels || '[]');
          const index = parseInt(file.fieldname.replace('doc_', ''), 10);
          if (docLabels[index]) docName = docLabels[index];
        } catch (e) { }
      }
      const safeDocName = docName.replace(/[^a-zA-Z0-9.\- ]/g, '').trim().replace(/\s+/g, '_');
      return `${baseFolder}/${safeDocName}`;
    },
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    // resource_type must be 'raw' for PDFs/Docs.
    // Using 'auto' treats PDFs as images and only preserves page 1,
    // causing multi-page content loss. 'raw' keeps the full file intact.
    resource_type: (req, file) => {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return 'raw';
      return 'image';
    },
    public_id: async (req, file) => {
      let cfNumber = 'UnknownCF';
      if (req.body.token) {
        if (!req.cachedCfNumber) {
          const studentToken = await StudentToken.findOne({ token: req.body.token });
          if (studentToken) req.cachedCfNumber = studentToken.cf_number;
        }
        if (req.cachedCfNumber) cfNumber = req.cachedCfNumber;
      }

      let docName = 'document';
      if (file.fieldname === 'agreement') {
        docName = 'Agreement';
      } else if (file.fieldname.startsWith('doc_')) {
        try {
          const docLabels = JSON.parse(req.body.doc_labels || '[]');
          const index = parseInt(file.fieldname.replace('doc_', ''), 10);
          if (docLabels[index]) docName = docLabels[index];
        } catch (e) { }
      }

      const ext = file.originalname.split('.').pop();
      return buildUploadFileName(cfNumber, docName, file.originalname, ext || 'pdf');
    },
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = file.originalname.toLowerCase().match(/\.[^.]+$/);
  if (ext && allowed.includes(ext[0])) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext ? ext[0] : 'unknown'} not allowed.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

module.exports = upload;