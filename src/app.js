const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { tenantMiddleware } = require('./middlewares/tenant.middleware');
const errorHandler = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rateLimiter.middleware');
const { successResponse, errorResponse } = require('./utils/response.util');

// Import Route Modules
const authRoutes = require('./modules/auth/auth.routes');
const packagesRoutes = require('./modules/packages/packages.routes');
const tenantsRoutes = require('./modules/tenants/tenants.routes');
const usersRoutes = require('./modules/users/users.routes');
const classesRoutes = require('./modules/classes/classes.routes');
const santriRoutes = require('./modules/santri/santri.routes');
const hafalanRoutes = require('./modules/hafalan/hafalan.routes');
const tahsinRoutes = require('./modules/tahsin/tahsin.routes');
const gamificationRoutes = require('./modules/gamification/gamification.routes');
const certificatesRoutes = require('./modules/certificates/certificates.routes');
const lmsRoutes = require('./modules/lms/lms.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const schedulesRoutes = require('./modules/schedules/schedules.routes');
const { runMurojaahReminder } = require('./jobs/murojaahReminder.job');
const { runSubscriptionChecker } = require('./jobs/subscriptionChecker.job');

const app = express();

// Security & Base Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static directory for locally uploaded assets (audio, certificates, avatars)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Tenant Isolation Middleware
app.use(tenantMiddleware);

// Health Check
app.get('/api/health', (req, res) => {
  return successResponse(res, 'SaaS Tahfidz & Tahsin API is healthy', {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tenantContext: req.tenant ? { id: req.tenant.id, name: req.tenant.name } : 'None (Global/SuperAdmin)',
  });
});

// Trigger Murojaah Reminder Job manually / by scheduler
app.post('/api/jobs/trigger-reminder', async (req, res) => {
  const result = await runMurojaahReminder();
  return successResponse(res, 'Pengingat Murojaah Spaced Repetition selesai dieksekusi.', result);
});

// Trigger Subscription Expiry Checker Job manually / for testing
app.post('/api/jobs/check-subscriptions', async (req, res) => {
  const result = await runSubscriptionChecker();
  return successResponse(res, 'Pemeriksaan status langganan tenant selesai dieksekusi.', result);
});

// Apply rate limiter to general api routes
app.use('/api', apiLimiter);

// Module Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/santri', santriRoutes);
app.use('/api/admin/santri', santriRoutes); // Mobile backward compatibility
app.use('/api/hafalan', hafalanRoutes);
app.use('/api/tahsin', tahsinRoutes);
app.use('/api/badges', gamificationRoutes);
app.use('/api/gamification', gamificationRoutes); // Mobile client alias
app.use('/api/certificates', certificatesRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/absensi', attendanceRoutes); // Indonesian alias
app.use('/api/schedules', schedulesRoutes);
app.use('/api/jadwal', schedulesRoutes); // Indonesian alias


// 404 Handler
app.use((req, res) => {
  return errorResponse(res, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
