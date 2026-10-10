const db = require('../../config/database');

class HafalanService {
  async getHistories(tenantId, filters = {}) {
    const { santri_id, class_id, type, jenis, limit, per_page } = filters;
    const filterType = type || jenis;
    const limitNum = Number(limit || per_page || 50);

    let query = db('hafalan_histories')
      .leftJoin('santri', 'hafalan_histories.santri_id', 'santri.id')
      .leftJoin('users as guru', 'hafalan_histories.guru_id', 'guru.id')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .where('hafalan_histories.tenant_id', tenantId)
      .select(
        'hafalan_histories.*',
        'santri.full_name as santri_name',
        'classes.name as class_name',
        'guru.name as guru_name'
      );

    if (santri_id) {
      query = query.where('hafalan_histories.santri_id', santri_id);
    }
    if (class_id) {
      query = query.where('santri.class_id', class_id);
    }
    if (filterType && filterType !== 'semua') {
      query = query.where('hafalan_histories.type', filterType);
    }

    const histories = await query.orderBy('hafalan_histories.date_recorded', 'desc').limit(limitNum);
    return histories.map((h) => ({
      ...h,
      jenis: h.jenis || h.type,
      surah: h.surah || h.surah_name,
      ayat_mulai: h.ayat_mulai || h.verse_start,
      ayat_selesai: h.ayat_selesai || h.verse_end,
      tanggal: h.tanggal || h.date_recorded,
      nilai: h.nilai || h.grade,
      status: h.status || h.grade,
      santri: {
        id: h.santri_id,
        name: h.santri_name || 'Santri',
        full_name: h.santri_name || 'Santri',
        kelas: { name: h.class_name || 'Halaqah' },
      },
    }));
  }



  async recordHafalan(tenantId, guruId, data) {
    const santri_id = data.santri_id;
    const type = data.type || data.jenis || 'ziyadah';
    const juz = Number(data.juz || 30);
    const surah_name = data.surah_name || data.surah || 'An-Naba';
    const surah_number = Number(data.surah_number || (data.juz === 30 ? 78 : 1));
    const verse_start = Number(data.verse_start || data.ayat_mulai || 1);
    const verse_end = Number(data.verse_end || data.ayat_selesai || 10);
    const grade = data.grade || data.nilai || 'Mumtaz';
    const notes = data.notes || data.catatan || null;
    const date_recorded = data.date_recorded || data.tanggal || db.fn.now();

    if (!santri_id || !type || !juz) {
      const err = new Error('Field santri_id, type, dan juz wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const [id] = await db('hafalan_histories').insert({
      tenant_id: tenantId,
      santri_id,
      guru_id: guruId || null,
      type, // ziyadah, tasmi, murojaah
      juz,
      surah_number,
      surah_name,
      verse_start,
      verse_end,
      grade,
      notes,
      date_recorded,
    });

    // Check if Tasmi' completion updates santri total_juz_hafalan
    if (type === 'tasmi') {
      const currentSantri = await db('santri').where({ id: santri_id }).first();
      if (currentSantri) {
        // Recount unique Juz completed with Tasmi'
        const completedJuzList = await db('hafalan_histories')
          .where({ santri_id, type: 'tasmi' })
          .distinct('juz');

        const newTotal = completedJuzList.length;
        if (newTotal > currentSantri.total_juz_hafalan) {
          await db('santri').where({ id: santri_id }).update({
            total_juz_hafalan: newTotal,
            updated_at: db.fn.now(),
          });
        }
      }
    }

    const recorded = await db('hafalan_histories').where({ id }).first();
    return recorded;
  }

  async getSantriHafalanSummary(tenantId, santriId) {
    const santri = await db('santri')
      .where({ id: santriId, tenant_id: tenantId })
      .first();

    if (!santri) {
      const err = new Error('Santri tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const histories = await db('hafalan_histories')
      .where({ santri_id: santriId })
      .orderBy('date_recorded', 'desc');

    const totalZiyadah = histories.filter((h) => h.type === 'ziyadah').length;
    const totalTasmi = histories.filter((h) => h.type === 'tasmi').length;
    const totalMurojaah = histories.filter((h) => h.type === 'murojaah').length;

    // Juz progress mapping (1 to 30)
    const juzMap = {};
    for (let j = 1; j <= 30; j++) {
      juzMap[j] = { juz: j, completed: false, countZiyadah: 0 };
    }
    histories.forEach((h) => {
      if (juzMap[h.juz]) {
        if (h.type === 'tasmi') {
          juzMap[h.juz].completed = true;
        }
        if (h.type === 'ziyadah') {
          juzMap[h.juz].countZiyadah += 1;
        }
      }
    });

    const statsObj = {
      total_setoran: histories.length,
      total_ziyadah: totalZiyadah,
      total_tasmi: totalTasmi,
      total_murojaah: totalMurojaah,
      total_juz_hafalan: Number(santri.total_juz_hafalan || 0),
    };

    const progressArray = Object.values(juzMap);
    const recentList = histories.slice(0, 10);

    return {
      santri,
      stats: statsObj,
      summary: statsObj,
      juz_progress: progressArray,
      juz_matrix: progressArray,
      recent_histories: recentList,
      recent_history: recentList,
    };
  }
}

module.exports = new HafalanService();
