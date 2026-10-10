const express = require('express');
const router = express.Router();
const hafalanController = require('./hafalan.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// View histories (All authenticated roles)
router.get('/', hafalanController.getHistories);
router.get('/histories', hafalanController.getHistories);

// View santri progress summary (Peta 30 Juz & metrics)
router.get('/summary/:santri_id', hafalanController.getSummary);
router.get('/santri/:santri_id/tracking', hafalanController.getSummary);

// Record setoran (Guru and Tenant Admin)
router.post('/record', authorize('super_admin', 'admin_tenant', 'guru'), hafalanController.record);
router.post('/', authorize('super_admin', 'admin_tenant', 'guru'), hafalanController.record);

module.exports = router;
