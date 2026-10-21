const db = require('../config/database');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

class NotificationService {
  /**
   * Save or update an Expo Push Token for a user
   */
  async saveToken(userId, token, deviceType = 'android') {
    if (!userId || !token) return null;
    const cleanToken = String(token).trim();

    try {
      const existing = await db('user_push_tokens')
        .where({ user_id: userId, token: cleanToken })
        .first();

      if (existing) {
        await db('user_push_tokens')
          .where({ id: existing.id })
          .update({
            device_type: deviceType,
            updated_at: db.fn.now(),
          });
        return existing;
      }

      const [id] = await db('user_push_tokens').insert({
        user_id: userId,
        token: cleanToken,
        device_type: deviceType,
      });

      logger.info(`[NOTIFICATION] Registered push token for user ID ${userId} (${deviceType})`);
      return { id, user_id: userId, token: cleanToken, device_type: deviceType };
    } catch (error) {
      logger.error(`[NOTIFICATION ERROR] Failed to save push token for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Remove a push token when user logs out or disables notifications
   */
  async removeToken(userId, token) {
    if (!token) return false;
    try {
      await db('user_push_tokens')
        .where({ user_id: userId, token: String(token).trim() })
        .del();
      logger.info(`[NOTIFICATION] Removed push token for user ID ${userId}`);
      return true;
    } catch (error) {
      logger.error(`[NOTIFICATION ERROR] Failed to remove push token:`, error.message);
      return false;
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId, { title, body, data = {}, sound = 'default', badge = 1 }) {
    if (!userId) return { success: false, reason: 'No user ID' };

    try {
      const tokens = await db('user_push_tokens')
        .where({ user_id: userId })
        .select('id', 'token');

      if (!tokens || tokens.length === 0) {
        logger.info(`[NOTIFICATION] No active push token registered for user ${userId}.`);
        return { success: false, reason: 'No tokens found' };
      }

      const messages = tokens.map((t) => ({
        to: t.token,
        sound,
        title,
        body,
        data: { ...data, userId },
        badge,
        priority: 'high',
        channelId: 'default',
      }));

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      logger.info(`[NOTIFICATION] Expo response for user ${userId}:`, JSON.stringify(result));

      // Handle DeviceNotRegistered tokens by pruning them from DB
      if (result.data && Array.isArray(result.data)) {
        for (let i = 0; i < result.data.length; i++) {
          const item = result.data[i];
          if (item.status === 'error' && item.details?.error === 'DeviceNotRegistered') {
            const staleToken = tokens[i];
            if (staleToken) {
              await db('user_push_tokens').where({ id: staleToken.id }).del();
              logger.info(`[NOTIFICATION] Pruned stale token for user ${userId}`);
            }
          }
        }
      }

      return { success: true, result };
    } catch (error) {
      logger.error(`[NOTIFICATION ERROR] Failed to send push to user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Send notification to Wali when a new setoran has been reviewed/graded by Ustadz
   */
  async notifyWaliSetoranBaru(santriId, { surahName, verseStart, verseEnd, grade, type = 'ziyadah' }) {
    try {
      const santri = await db('santri').where({ id: santriId }).first();
      if (!santri || !santri.wali_id) return;

      const typeLabel = type === 'ziyadah' ? 'Ziyadah' : (type === 'murojaah' ? "Muroja'ah" : "Tasmi'");
      const title = `Setoran Hafalan ${typeLabel} Dinilai`;
      const gradeText = grade ? ` dengan nilai ${grade}` : '';
      const body = `Alhamdulillah, setoran ${typeLabel} Ananda ${santri.full_name} (${surahName} ayat ${verseStart}-${verseEnd}) telah dievaluasi${gradeText}.`;

      await this.sendToUser(santri.wali_id, {
        title,
        body,
        data: {
          type: 'setoran_dinilai',
          santri_id: santriId,
          surah_name: surahName,
        },
      });
    } catch (err) {
      logger.error(`[NOTIFICATION] Error in notifyWaliSetoranBaru:`, err.message);
    }
  }

  /**
   * Helper: Send notification to Wali when a Tahsin audio feedback has been recorded
   */
  async notifyWaliTahsinKoreksi(santriId, { surahName, verseStart, verseEnd }) {
    try {
      const santri = await db('santri').where({ id: santriId }).first();
      if (!santri || !santri.wali_id) return;

      const title = 'Koreksi Tahsin Suara dari Ustadz';
      const body = `Ustadz telah memberikan evaluasi dan rekaman suara koreksi untuk Ananda ${santri.full_name} (${surahName} ayat ${verseStart}-${verseEnd}).`;

      await this.sendToUser(santri.wali_id, {
        title,
        body,
        data: {
          type: 'tahsin_koreksi',
          santri_id: santriId,
        },
      });
    } catch (err) {
      logger.error(`[NOTIFICATION] Error in notifyWaliTahsinKoreksi:`, err.message);
    }
  }

  /**
   * Helper: Send Spaced Repetition Muroja'ah Reminder
   */
  async notifyMurojaahSpacedRepetition(santriId, { santriName, waliId, lastMurojaahDays = 7 }) {
    if (!waliId) return;
    try {
      const title = "Pengingat Pintar Muroja'ah 🌿";
      const body = `Ananda ${santriName} belum mengulang hafalan dalam ${lastMurojaahDays} hari terakhir. Yuk luangkan waktu untuk muroja'ah hari ini agar hafalan tetap mutqin!`;

      await this.sendToUser(waliId, {
        title,
        body,
        data: {
          type: 'murojaah_reminder',
          santri_id: santriId,
        },
      });
    } catch (err) {
      logger.error(`[NOTIFICATION] Error in notifyMurojaahSpacedRepetition:`, err.message);
    }
  }
}

module.exports = new NotificationService();
