const db = require('../../config/database');

class GamificationService {
  async getBadgesBySantri(tenantId, santriId) {
    const badges = await db('badges')
      .where({ tenant_id: tenantId, santri_id: santriId })
      .orderBy('awarded_at', 'desc');

    const santri = await db('santri').where({ id: santriId }).first();

    return {
      santri_name: santri?.full_name || 'Santri',
      total_badges: badges.length,
      badges,
    };
  }

  async awardBadge(tenantId, santriId, data) {
    const { badge_code, badge_name, description, icon_url } = data;

    const [id] = await db('badges').insert({
      tenant_id: tenantId,
      santri_id: santriId,
      badge_code: badge_code || 'BADGE_PRESTASI',
      badge_name: badge_name || 'Lencana Prestasi',
      description: description || 'Diberikan atas capaian hafalan Al-Quran.',
      icon_url: icon_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      awarded_at: db.fn.now(),
    });

    return db('badges').where({ id }).first();
  }
}

module.exports = new GamificationService();
