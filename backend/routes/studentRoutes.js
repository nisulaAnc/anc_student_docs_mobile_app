const router = require('express').Router();
const upload = require('../middleware/upload');
const {
  studentRequestOTP, studentVerifyOTP, getStudentTokenInfo,
  submitDocuments, getSubmission,
} = require('../controllers/studentController');

router.post('/request-otp', studentRequestOTP);
router.post('/verify-otp', studentVerifyOTP);
router.get('/token-info', getStudentTokenInfo);
router.post('/submit-documents', upload.any(), submitDocuments);
router.get('/submission', getSubmission);

module.exports = router;
