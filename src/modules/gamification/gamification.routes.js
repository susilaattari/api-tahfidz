const express = require('express');
const router = express.Router();
const gamificationController = require('./gamification.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { requireFeature } = require('../../middlewares/feature.middleware');

router.use(authenticate);

// View badges
router.get('/santri/:santri_id', gamificationController.getSantriBadges);

// Award badge (Guru, Tenant Admin, Super Admin)
router.post('/santri/:santri_id/award', authorize('super_admin', 'admin_tenant', 'guru'), requireFeature('badges'), gamificationController.awardBadge);

module.exports = router;
