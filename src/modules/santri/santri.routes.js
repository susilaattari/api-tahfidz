const express = require('express');
const router = express.Router();
const santriController = require('./santri.controller');
const hafalanController = require('../hafalan/hafalan.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// View santri (Guru, Tenant Admin, Super Admin)
router.get('/', authorize('super_admin', 'admin_tenant', 'guru'), santriController.getAll);

// Penilaian Hafalan Cepat (PRD §11): posisi hafalan & riwayat setoran. Wali hanya anak sendiri.
router.get('/:id(\\d+)/posisi', authorize('super_admin', 'admin_tenant', 'guru', 'wali_santri'), hafalanController.getPosisi);
router.get('/:id(\\d+)/setoran', authorize('super_admin', 'admin_tenant', 'guru', 'wali_santri'), hafalanController.getSantriSetoran);

router.get('/:id', authorize('super_admin', 'admin_tenant', 'guru', 'wali_santri'), santriController.getById);

// Manage santri (Tenant Admin, Super Admin)
router.post('/', authorize('super_admin', 'admin_tenant'), santriController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant'), santriController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant'), santriController.delete);

module.exports = router;
