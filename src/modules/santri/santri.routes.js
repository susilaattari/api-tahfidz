const express = require('express');
const router = express.Router();
const santriController = require('./santri.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// View santri (Guru, Tenant Admin, Super Admin)
router.get('/', authorize('super_admin', 'admin_tenant', 'guru'), santriController.getAll);
router.get('/:id', authorize('super_admin', 'admin_tenant', 'guru', 'wali_santri'), santriController.getById);

// Manage santri (Tenant Admin, Super Admin)
router.post('/', authorize('super_admin', 'admin_tenant'), santriController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant'), santriController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant'), santriController.delete);

module.exports = router;
