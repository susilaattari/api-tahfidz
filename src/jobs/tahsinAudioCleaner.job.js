const cron = require('node-cron');
const tahsinService = require('../modules/tahsin/tahsin.service');
const logger = require('../utils/logger');

/**
 * Background Cron Job: Membersihkan file audio setoran & koreksi tahsin yang berumur lebih dari 7 hari (1 minggu)
 * Dijalankan setiap hari pukul 02:30 dini hari.
 */
async function runTahsinAudioCleaner() {
  logger.info('[TAHSIN CLEANER CRON] Menjalankan pembersihan otomatis file audio > 7 hari...');
  try {
    const result = await tahsinService.autoCleanOldAudios(7);
    logger.info(`[TAHSIN CLEANER CRON] Selesai. ${result.cleanedCount} file audio lama berhasil dibersihkan dari server.`);
    return result;
  } catch (error) {
    logger.error('[TAHSIN CLEANER CRON] Terjadi kesalahan saat pembersihan otomatis:', error);
    throw error;
  }
}

function initTahsinAudioCleanerCronJob() {
  // Setiap hari pukul 02:30 WIB
  cron.schedule('30 2 * * *', async () => {
    try {
      await runTahsinAudioCleaner();
    } catch (e) {
      // logger error already handled
    }
  });
  logger.info('[SCHEDULER] Tahsin Audio Cleaner terjadwal aktif pada "30 2 * * *" (Setiap hari jam 02:30).');
}

module.exports = {
  runTahsinAudioCleaner,
  initTahsinAudioCleanerCronJob,
};
