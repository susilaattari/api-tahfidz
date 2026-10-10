const express = require('express');
const router = express.Router();
const classesController = require('./classes.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

// View classes
router.get('/', classesController.getAll);
router.get('/:id', classesController.getById);

// Manage classes (Tenant Admin or Super Admin)
router.post('/', authorize('super_admin', 'admin_tenant'), classesController.create);
router.put('/:id', authorize('super_admin', 'admin_tenant'), classesController.update);
router.delete('/:id', authorize('super_admin', 'admin_tenant'), classesController.delete);

module.exports = router;
