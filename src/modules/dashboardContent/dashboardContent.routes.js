const express = require('express');
const router = express.Router();
const dashboardContentController = require('./dashboardContent.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Public endpoints (no login required for subdomain landing / root page)
router.get('/public', dashboardContentController.getPublic);
router.get('/public/:subdomain', dashboardContentController.getPublic);

// Superadmin CRUD endpoints
router.get('/', authenticate, authorize('super_admin'), dashboardContentController.getAdmin);
router.put('/', authenticate, authorize('super_admin'), dashboardContentController.updateGlobal);
router.post('/tenant/:tenantId', authenticate, authorize('super_admin'), dashboardContentController.upsertTenantOverride);
router.delete('/tenant/:tenantId', authenticate, authorize('super_admin'), dashboardContentController.deleteTenantOverride);

module.exports = router;
