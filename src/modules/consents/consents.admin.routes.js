const express = require('express');
const router = express.Router();
const controller = require('./consents.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate, authorize('admin_tenant', 'super_admin'));

router.get('/summary', controller.summary);
router.get('/export', controller.exportCsv);
router.get('/', controller.listAdmin);
router.get('/:id', controller.detail);

module.exports = router;
