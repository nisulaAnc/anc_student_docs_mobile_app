const router = require('express').Router();
const { getCounsellorList, registerCF, getCounsellorTokenInfo, verifyCfPin, getDashboardStats, sendReminderEmail } = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', registerCF);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);
router.get('/dashboard-stats', getDashboardStats);
router.post('/send-reminder', sendReminderEmail);

module.exports = router;
