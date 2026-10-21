const express = require('express');
const router = express.Router();
const quotaRequestsController = require('./quotaRequests.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// Admin Tenant: lihat kuota sendiri, ajukan, batalkan
router.get('/mine', authorize('admin_tenant'), quotaRequestsController.getMine);
router.post('/', authorize('admin_tenant'), quotaRequestsController.create);
router.put('/:id/cancel', authorize('admin_tenant'), quotaRequestsController.cancel);

// Super Admin: daftar & keputusan
router.get('/', authorize('super_admin'), quotaRequestsController.listAll);
router.put('/:id/approve', authorize('super_admin'), quotaRequestsController.approve);
router.put('/:id/reject', authorize('super_admin'), quotaRequestsController.reject);

module.exports = router;
