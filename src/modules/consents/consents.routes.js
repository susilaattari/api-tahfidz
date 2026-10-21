const express = require('express');
const router = express.Router();
const controller = require('./consents.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/requirements', controller.requirements);
router.get('/me', controller.history);
router.post('/', controller.approve);
router.patch('/:id/revoke', controller.revoke);

module.exports = router;
