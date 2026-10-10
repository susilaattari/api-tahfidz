const express = require('express');
const router = express.Router();
const schedulesController = require('./schedules.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// Ambil jadwal (bisa diakses semua role: Guru, Wali, Santri, Admin)
router.get('/', schedulesController.getAll);

// Kelola jadwal (Admin atau Guru)
router.post('/', authorize('super_admin', 'admin_tenant', 'guru'), schedulesController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant', 'guru'), schedulesController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant', 'guru'), schedulesController.delete);

module.exports = router;
