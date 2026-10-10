const express = require('express');
const router = express.Router();
const tenantsController = require('./tenants.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Public endpoint to resolve tenant by subdomain (for login branding)
router.get('/public/:subdomain', tenantsController.getBySubdomain);

// Public or Tenant check: Get tenant by id / details
router.get('/', authenticate, authorize('super_admin'), tenantsController.getAll);
router.get('/:id', authenticate, tenantsController.getById);

// Super Admin management
router.post('/', authenticate, authorize('super_admin'), tenantsController.create);
router.put('/:id', authenticate, authorize('super_admin'), tenantsController.update);
router.delete('/:id', authenticate, authorize('super_admin'), tenantsController.delete);

// Theme customization (Tenant Admin or Super Admin)
router.put('/:id/theme', authenticate, authorize('super_admin', 'admin_tenant'), tenantsController.updateTheme);

module.exports = router;
