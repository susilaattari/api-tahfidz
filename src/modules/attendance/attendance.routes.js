const express = require('express');
const router = express.Router();
const attendanceController = require('./attendance.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// Catat absensi halaqah (Guru atau Admin)
router.post('/', authorize('super_admin', 'admin_tenant', 'guru'), attendanceController.record);

// Ambil absensi kelas & tanggal
router.get('/', attendanceController.getByClassAndDate);

// Riwayat tanggal absensi (untuk Guru & Admin)
router.get('/history', attendanceController.getHistoryDates);

// Riwayat absensi per santri (bisa diakses Wali, Guru, Admin)
router.get('/santri/:santriId', attendanceController.getBySantri);

module.exports = router;
