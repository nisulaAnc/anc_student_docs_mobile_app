const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

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
    folder: process.env.CLOUDINARY_FOLDER || 'anc_student_docs',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    public_id: (req, file) => {
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const unique = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      return `${unique}_${safeOriginal.split('.')[0]}`;
    },
    resource_type: 'raw',
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;