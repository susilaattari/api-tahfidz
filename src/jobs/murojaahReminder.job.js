const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Spaced Repetition Muroja'ah Reminder Logic
 * Identifies hafalan that has not been reviewed in > 7 days and triggers reminder.
 */
async function runMurojaahReminder() {
  logger.info('[CRON JOB] Memulai pengecekan Spaced Repetition Murojaah...');

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Find santri with setoran older than 7 days without recent muroja'ah
    const santriToRemind = await db('santri')
      .leftJoin('users as wali', 'santri.wali_id', 'wali.id')
      .leftJoin('tenants', 'santri.tenant_id', 'tenants.id')
      .select(
        'santri.id as santri_id',
        'santri.full_name as santri_name',
        'santri.total_juz_hafalan',
        'wali.id as wali_id',
        'wali.name as wali_name',
        'wali.email as wali_email',
        'wali.phone as wali_phone',
        'tenants.name as tenant_name'
      );

    const remindersIssued = [];

    for (const item of santriToRemind) {
      const recentMurojaah = await db('hafalan_histories')
        .where({
          santri_id: item.santri_id,
          type: 'murojaah',
        })
        .where('date_recorded', '>=', sevenDaysAgo)
        .first();

      if (!recentMurojaah) {
        remindersIssued.push({
          santri_id: item.santri_id,
          santri_name: item.santri_name,
          wali_name: item.wali_name,
          message: `Pengingat Muroja'ah: Ananda ${item.santri_name} belum mengulang hafalan dalam 7 hari terakhir. Yuk muroja'ah hari ini!`,
        });
      }
    }

    logger.info(`[CRON JOB] Selesai. Diterbitkan ${remindersIssued.length} pengingat murojaah.`);
    return remindersIssued;
  } catch (error) {
    logger.error('[CRON JOB ERROR] Gagal menjalankan murojaah reminder:', error);
    return [];
  }
}

/**
 * Initialize automatic background cron scheduler
 */
function initMurojaahCronJob() {
  const cronExpression = process.env.MUROJAAH_CRON_SCHEDULE || '0 6 * * *'; // Setiap jam 06:00 pagi
  logger.info(`[SCHEDULER] Spaced Repetition Murojaah terjadwal aktif pada format cron: "${cronExpression}"`);
  
  return cron.schedule(cronExpression, async () => {
    logger.info('[SCHEDULER] Memicu eksekusi terjadwal Spaced Repetition Murojaah...');
    await runMurojaahReminder();
  });
}

module.exports = {
  runMurojaahReminder,
  initMurojaahCronJob,
};

