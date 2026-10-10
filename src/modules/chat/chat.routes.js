const express = require('express');
const router = express.Router();
const chatController = require('./chat.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', chatController.getMessages);
router.post('/send', chatController.send);

module.exports = router;
