require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 8099;

const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Attach Socket.io to app instance so controllers can emit events if needed
app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`Socket client connected: ${socket.id}`);

  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    logger.info(`Socket ${socket.id} joined room: ${roomName}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket client disconnected: ${socket.id}`);
  });
});

const { initMurojaahCronJob } = require('./jobs/murojaahReminder.job');
const { initSubscriptionCronJob } = require('./jobs/subscriptionChecker.job');
const { initTahsinAudioCleanerCronJob } = require('./jobs/tahsinAudioCleaner.job');

server.listen(PORT, () => {
  logger.info(`=================================================`);
  logger.info(`🚀 SaaS Tahfidz & Tahsin API running on port ${PORT}`);
  logger.info(`📡 URL: http://localhost:${PORT}`);
  logger.info(`🩺 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`=================================================`);

  // Start Background Cron Schedulers
  initMurojaahCronJob();
  initSubscriptionCronJob();
  initTahsinAudioCleanerCronJob();
});


// Handle uncaught exceptions
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
});
