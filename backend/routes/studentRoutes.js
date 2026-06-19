const router = require('express').Router();
const upload = require('../middleware/upload');
const {
  getStudentTokenInfo,
  submitDocuments, getSubmission,
} = require('../controllers/studentController');

router.get('/token-info', getStudentTokenInfo);
router.post('/submit-documents', upload.any(), submitDocuments);
router.get('/submission', getSubmission);

module.exports = router;
