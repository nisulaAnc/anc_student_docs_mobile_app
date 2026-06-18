const router = require('express').Router();
const { getCounsellorList, registerCF, counsellorRequestOTP, counsellorVerifyOTP, getCounsellorTokenInfo, verifyCfPin } = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', registerCF);
router.post('/counsellor/request-otp', counsellorRequestOTP);
router.post('/counsellor/verify-otp', counsellorVerifyOTP);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);

module.exports = router;
