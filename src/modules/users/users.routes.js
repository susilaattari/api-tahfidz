const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// List and view users (Admins and Guru can view teachers directory)
router.get('/', authorize('super_admin', 'admin_tenant', 'guru'), usersController.getAll);
router.get('/:id', authorize('super_admin', 'admin_tenant', 'guru'), usersController.getById);

// Push Notification token registration for current authenticated user
router.post('/push-token', usersController.savePushToken);
router.post('/push-token/remove', usersController.removePushToken);
router.post('/test-notification', usersController.sendTestNotification);

// Create, edit, delete (Tenant Admin / Super Admin ONLY)
router.post('/', authorize('super_admin', 'admin_tenant'), usersController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant'), usersController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant'), usersController.delete);

module.exports = router;

