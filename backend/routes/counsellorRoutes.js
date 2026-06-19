const router = require('express').Router();
const { getPrograms, selectProgram } = require('../controllers/counsellorController');

router.get('/programs', getPrograms);
router.post('/select-program', selectProgram);

module.exports = router;
