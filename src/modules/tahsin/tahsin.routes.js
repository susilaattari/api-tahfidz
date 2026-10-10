const express = require('express');
const multer = require('multer');
const router = express.Router();
const tahsinController = require('./tahsin.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit

router.use(authenticate);

// View list and detail
router.get('/', tahsinController.getAll);
router.get('/:id', tahsinController.getById);

// Submit voice note (Wali / Santri)
router.post('/submit', upload.single('audio'), tahsinController.submit);

// Review submission (Guru & Tenant Admin)
router.post('/:id/review', authorize('super_admin', 'admin_tenant', 'guru'), upload.single('feedback_audio'), tahsinController.review);

// Delete submission to free audio storage & memory
router.delete('/:id', authorize('super_admin', 'admin_tenant', 'guru', 'wali'), tahsinController.delete);
router.post('/:id/clean-audio', authorize('super_admin', 'admin_tenant', 'guru', 'wali'), tahsinController.cleanAudio);

module.exports = router;
