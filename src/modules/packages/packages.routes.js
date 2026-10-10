const express = require('express');
const router = express.Router();
const packagesController = require('./packages.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Public can list packages (for subscription marketing page)
router.get('/', packagesController.getAll);
router.get('/:id', packagesController.getById);

// Only Super Admin can create, update, or delete packages
router.post('/', authenticate, authorize('super_admin'), packagesController.create);
router.put('/:id', authenticate, authorize('super_admin'), packagesController.update);
router.delete('/:id', authenticate, authorize('super_admin'), packagesController.delete);

module.exports = router;
