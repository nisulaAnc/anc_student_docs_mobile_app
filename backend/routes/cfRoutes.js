const router = require('express').Router();
const {
    getCounsellorList,
    registerCF,
    registerStaff,
    loginStaff,
    forgotPassword,
    resetPassword,
    getCounsellorTokenInfo,
    verifyCfPin,
    getDashboardStats,
    sendReminderEmail,
    registerCounsellorAccount,
    resetCounsellorPin,
    setupTwoFactor,
    enableTwoFactor,
} = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', registerCF);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);
router.post('/staff/register', registerStaff);
router.post('/staff/login', loginStaff);
router.post('/staff/forgot-password', forgotPassword);
router.post('/staff/reset-password', resetPassword);
router.post('/counsellor/register', registerCounsellorAccount);
router.post('/counsellor/reset-pin', resetCounsellorPin);
router.post('/two-factor/setup', setupTwoFactor);
router.post('/two-factor/enable', enableTwoFactor);
router.get('/dashboard-stats', getDashboardStats);
router.post('/send-reminder', sendReminderEmail);

module.exports = router;
