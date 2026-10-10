const express = require('express');
const router = express.Router();
const lmsController = require('./lms.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { requireFeature } = require('../../middlewares/feature.middleware');

router.use(authenticate);

// View LMS materials (Enforce LMS package feature)
router.get('/', requireFeature('lms'), lmsController.getAll);
router.get('/:id', requireFeature('lms'), lmsController.getById);

// Manage LMS materials (Super Admin, Tenant Admin, and authorized Guru with LMS package feature)
router.post('/', authorize('super_admin', 'admin_tenant', 'guru'), requireFeature('lms'), lmsController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant', 'guru'), requireFeature('lms'), lmsController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant', 'guru'), requireFeature('lms'), lmsController.delete);

module.exports = router;
