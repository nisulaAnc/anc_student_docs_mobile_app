const router = require('express').Router();
const { emailRateLimit, passwordResetRateLimit } = require('../middleware/emailRateLimit');
const {
    getCounsellorList,
    registerCF,
    registerStaff,
    loginStaff,
    sendLoginOtp,
    forgotPassword,
    resetPassword,
    changePassword,
    getCounsellorTokenInfo,
    verifyCfPin,
    getDashboardStats,
    sendReminderEmail,
    registerCounsellorAccount,
    resetCounsellorPin,
    setupTwoFactor,
    enableTwoFactor,
    sendTwoFactorEmailCode,
} = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', emailRateLimit, registerCF);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);
router.post('/staff/register', emailRateLimit, registerStaff);
router.post('/staff/login', loginStaff);
router.post('/staff/send-login-otp', emailRateLimit, sendLoginOtp);
router.post('/staff/forgot-password', passwordResetRateLimit, forgotPassword);
router.post('/staff/reset-password', resetPassword);
router.post('/staff/change-password', changePassword);
router.post('/counsellor/register', registerCounsellorAccount);
router.post('/counsellor/reset-pin', resetCounsellorPin);
router.post('/two-factor/setup', setupTwoFactor);
router.post('/two-factor/send-email-code', emailRateLimit, sendTwoFactorEmailCode);
router.post('/two-factor/enable', emailRateLimit, enableTwoFactor);
router.get('/dashboard-stats', getDashboardStats);
router.post('/send-reminder', emailRateLimit, sendReminderEmail);

module.exports = router;
