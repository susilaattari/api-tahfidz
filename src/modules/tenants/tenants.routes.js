const express = require('express');
const router = express.Router();
const tenantsController = require('./tenants.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Public endpoints
router.get('/public/:subdomain', tenantsController.getBySubdomain);
router.post('/register', tenantsController.registerSelf);

// Specific sub-resource actions (placed before generic /:id)
router.put('/:id/theme', authenticate, authorize('super_admin', 'admin_tenant'), tenantsController.updateTheme);
router.put('/:id/settings', authenticate, authorize('super_admin', 'admin_tenant'), tenantsController.updateSettings);
router.put('/:id/quota', authenticate, authorize('super_admin'), tenantsController.addQuota);
router.put('/:id/approve', authenticate, authorize('super_admin'), tenantsController.approve);
router.put('/:id/reject', authenticate, authorize('super_admin'), tenantsController.reject);

// Generic Tenant CRUD & Summary
router.get('/platform-summary', authenticate, authorize('super_admin'), tenantsController.getPlatformSummary);
router.get('/', authenticate, authorize('super_admin'), tenantsController.getAll);
router.get('/:id', authenticate, tenantsController.getById);
router.post('/', authenticate, authorize('super_admin'), tenantsController.create);
router.put('/:id', authenticate, authorize('super_admin'), tenantsController.update);
router.delete('/:id', authenticate, authorize('super_admin'), tenantsController.delete);

module.exports = router;
