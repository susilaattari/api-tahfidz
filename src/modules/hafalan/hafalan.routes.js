const express = require('express');
const router = express.Router();
const hafalanController = require('./hafalan.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// View histories (All authenticated roles — wali hanya melihat anaknya sendiri)
router.get('/', hafalanController.getHistories);
router.get('/histories', hafalanController.getHistories);

// View santri progress summary (Peta 30 Juz & metrics)
router.get('/summary/:santri_id', hafalanController.getSummary);
router.get('/santri/:santri_id/tracking', hafalanController.getSummary);

// Posisi hafalan berikutnya & daftar ayat yang perlu diulang (Guru, Admin, Wali anak sendiri)
router.get('/santri/:santri_id/posisi', hafalanController.getPosisi);
router.get('/santri/:santri_id/ulang', hafalanController.getDaftarUlang);

// Record setoran (Guru and Tenant Admin)
router.post('/record', authorize('super_admin', 'admin_tenant', 'guru'), hafalanController.record);
router.post('/', authorize('super_admin', 'admin_tenant', 'guru'), hafalanController.record);

// Detail setoran + penilaian per ayat (All authenticated roles — wali hanya anak sendiri)
router.get('/:id(\\d+)', hafalanController.getDetail);

// Koreksi setoran (ustad pembimbing / admin, dalam batas waktu; tercatat di log_koreksi)
router.patch('/:id(\\d+)', authorize('super_admin', 'admin_tenant', 'guru'), hafalanController.correct);

module.exports = router;
