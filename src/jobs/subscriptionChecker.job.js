const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Calculates days remaining and expiration status for a given tenant
 */
function getSubscriptionMeta(tenant) {
  if (!tenant || !tenant.subscription_expires_at) {
    return {
      subscription_expires_at: null,
      days_remaining: null,
      is_expiring_soon: false,
      is_expired: false,
      subscription_status: tenant?.status || 'active',
    };
  }

  const now = new Date();
  const expiresAt = new Date(tenant.subscription_expires_at);
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isExpired = diffDays <= 0 || tenant.status === 'suspended';
  const isExpiringSoon = !isExpired && diffDays <= 7; // Warning on H-7 to H-1

  return {
    subscription_expires_at: tenant.subscription_expires_at,
    days_remaining: Math.max(0, diffDays),
    is_expiring_soon: isExpiringSoon,
    is_expired: isExpired,
    subscription_status: isExpired ? 'suspended' : isExpiringSoon ? 'expiring_soon' : 'active',
  };
}

/**
 * Executes the subscription check and suspends expired tenants
 */
async function runSubscriptionChecker() {
  logger.info('[SUBSCRIPTION CRON] Memulai pemeriksaan masa aktif langganan tenant...');
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 19).replace('T', ' ');

  // Find all active tenants whose expiration date is in the past
  const expiredTenants = await db('tenants')
    .where('status', '!=', 'suspended')
    .whereNotNull('subscription_expires_at')
    .where('subscription_expires_at', '<', nowIso);

  const suspendedCount = expiredTenants.length;

  for (const tenant of expiredTenants) {
    await db('tenants')
      .where({ id: tenant.id })
      .update({
        status: 'suspended',
        updated_at: db.fn.now(),
      });

    logger.warn(
      `[SUBSCRIPTION CRON] 🚫 Langganan Tenant ID ${tenant.id} ("${tenant.name}") telah habis per ${tenant.subscription_expires_at}. Status otomatis diubah menjadi "suspended".`
    );
  }

  // Count expiring soon tenants (1 to 7 days remaining) for logging
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const expiringSoon = await db('tenants')
    .where('status', 'active')
    .whereNotNull('subscription_expires_at')
    .whereBetween('subscription_expires_at', [nowIso, in7Days]);

  logger.info(
    `[SUBSCRIPTION CRON] Selesai. Disuspend: ${suspendedCount} tenant. Mendekati jatuh tempo (H-7): ${expiringSoon.length} tenant.`
  );

  return {
    suspended_count: suspendedCount,
    suspended_tenants: expiredTenants.map((t) => ({ id: t.id, name: t.name, expires_at: t.subscription_expires_at })),
    expiring_soon_count: expiringSoon.length,
    expiring_soon_tenants: expiringSoon.map((t) => ({ id: t.id, name: t.name, expires_at: t.subscription_expires_at })),
  };
}

/**
 * Initializes the cron scheduler (runs every hour at minute 0)
 */
function initSubscriptionCronJob() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await runSubscriptionChecker();
    } catch (err) {
      logger.error('[SUBSCRIPTION CRON] Error executing subscription checker job:', err);
    }
  });

  logger.info('[SCHEDULER] Subscription Auto-Suspend Checker aktif (berjalan setiap jam).');
}

module.exports = {
  getSubscriptionMeta,
  runSubscriptionChecker,
  initSubscriptionCronJob,
};
