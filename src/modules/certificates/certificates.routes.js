const express = require('express');
const router = express.Router();
const certificatesController = require('./certificates.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { requireFeature } = require('../../middlewares/feature.middleware');

router.use(authenticate);

// View certificates
router.get('/santri/:santri_id', certificatesController.getSantriCertificates);
router.get('/:id', certificatesController.getById);

// Issue certificate (Guru, Tenant Admin, Super Admin)
router.post('/issue', authorize('super_admin', 'admin_tenant', 'guru'), requireFeature('certificates'), certificatesController.issue);

module.exports = router;
