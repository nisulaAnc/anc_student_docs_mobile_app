const router = require('express').Router();
const { getCounsellorList, registerCF, getCounsellorTokenInfo, verifyCfPin } = require('../controllers/cfController');

router.get('/counsellors', getCounsellorList);
router.post('/register', registerCF);
router.get('/counsellor/token-info', getCounsellorTokenInfo);
router.post('/verify-pin', verifyCfPin);

module.exports = router;
