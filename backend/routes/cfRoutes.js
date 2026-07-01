const router = require('express').Router();
const {
    getCounsellorList,
    registerCF,
    getCounsellorTokenInfo,
    verifyCfPin,
    getDashboardStats,
    sendReminderEmail,
    registerCounsellorAccount,
    resetCounsellorPin,
} = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', registerCF);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);
router.post('/counsellor/register', registerCounsellorAccount);
router.post('/counsellor/reset-pin', resetCounsellorPin);
router.get('/dashboard-stats', getDashboardStats);
router.post('/send-reminder', sendReminderEmail);

module.exports = router;
