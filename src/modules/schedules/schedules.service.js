const db = require('../../config/database');

const DEFAULT_SCHEDULES = [
  {
    day: 'Senin',
    time_start: '05:00',
    time_end: '06:15',
    activity_name: 'Setoran Ziyadah Hafalan Baru',
    location: 'Masjid Utama (Halaqah Utsman)',
    description: 'Fokus penambahan hafalan baru minimal 1 halaman per santri.',
  },
  {
    day: 'Senin',
    time_start: '16:00',
    time_end: '17:15',
    activity_name: 'Murajaah Ashar Terpadu',
    location: 'Serambi Masjid Tahfidz',
    description: 'Pengulangan hafalan juz lampau secara berpasangan (simak-menyimak).',
  },
  {
    day: 'Selasa',
    time_start: '05:00',
    time_end: '06:15',
    activity_name: 'Setoran Ziyadah Hafalan Baru',
    location: 'Masjid Utama (Halaqah Utsman)',
    description: 'Setoran hafalan baru ke ustadz pengampu halaqah.',
  },
  {
    day: 'Selasa',
    time_start: '08:30',
    time_end: '10:00',
    activity_name: 'Bimbingan Tahsin & Kaidah Tajwid',
    location: 'Ruang Kelas Halaqah 1',
    description: 'Pendalaman makharijul huruf dan sifatul huruf standar riwayah Hafsh.',
  },
  {
    day: 'Rabu',
    time_start: '05:00',
    time_end: '06:15',
    activity_name: 'Setoran Ziyadah Hafalan Baru',
    location: 'Masjid Utama (Halaqah Utsman)',
    description: 'Penyetoran ayat baru dan talaqqi bacaan selanjutnya.',
  },
  {
    day: 'Rabu',
    time_start: '16:00',
    time_end: '17:15',
    activity_name: 'Murajaah Manzil Pekanan',
    location: 'Serambi Masjid Tahfidz',
    description: 'Penguatan 5 juz terakhir yang telah dihafal.',
  },
  {
    day: 'Kamis',
    time_start: '05:00',
    time_end: '06:15',
    activity_name: 'Setoran Ziyadah & Uji Sambung Ayat',
    location: 'Masjid Utama (Halaqah Utsman)',
    description: 'Ujian acak sambung ayat antar santri satu halaqah.',
  },
  {
    day: 'Kamis',
    time_start: '18:30',
    time_end: '19:45',
    activity_name: 'Kajian Adab Penghafal Al-Qur\'an (At-Tibyan)',
    location: 'Masjid Utama',
    description: 'Kajian kitab At-Tibyan fii Adabi Hamalatil Qur\'an.',
  },
  {
    day: 'Jumat',
    time_start: '05:00',
    time_end: '06:30',
    activity_name: 'Tasmi\' Akbar & Evaluasi Pekanan',
    location: 'Aula Pesantren Tahfidz',
    description: 'Ujian tasmi sekali duduk 1/2 juz atau 1 juz di depan asatidz.',
  },
  {
    day: 'Sabtu',
    time_start: '05:30',
    time_end: '07:00',
    activity_name: 'Murajaah Mandiri & Olahraga Sunnah',
    location: 'Halaman & Lapangan Tahfidz',
    description: 'Olahraga memanah/lari pagi dilanjutkan murajaah mandiri.',
  },
  {
    day: 'Minggu',
    time_start: '08:00',
    time_end: '10:00',
    activity_name: 'Pertemuan Halaqah & Sambang Wali',
    location: 'Gazebo & Ruang Temu Santri',
    description: 'Waktu silaturahmi wali santri dan laporan perkembangan hafalan.',
  },
];

class SchedulesService {
  async getSchedules(tenantId, query = {}) {
    const { day, class_id } = query;

    let q = db('schedules')
      .leftJoin('users', 'schedules.guru_id', 'users.id')
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .where('schedules.tenant_id', tenantId)
      .select(
        'schedules.*',
        'users.name as guru_name',
        'classes.name as class_name'
      );

    if (day) q = q.where('schedules.day', day);
    if (class_id) q = q.where('schedules.class_id', class_id);

    let schedules = await q;

    // Jika belum ada jadwal sama sekali untuk tenant ini, inisialisasi default schedule
    if (schedules.length === 0 && !day && !class_id) {
      const insertRows = DEFAULT_SCHEDULES.map((s) => ({
        ...s,
        tenant_id: tenantId,
      }));
      await db('schedules').insert(insertRows);

      schedules = await db('schedules')
        .where('tenant_id', tenantId)
        .select('*');
    }

    const DAY_ORDER = {
      Senin: 1,
      Selasa: 2,
      Rabu: 3,
      Kamis: 4,
      Jumat: 5,
      Sabtu: 6,
      Minggu: 7,
    };

    schedules.sort((a, b) => {
      const orderA = DAY_ORDER[a.day] || 99;
      const orderB = DAY_ORDER[b.day] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.time_start).localeCompare(String(b.time_start));
    });

    return schedules;
  }

  async createSchedule(tenantId, data) {
    const { day, time_start, time_end, activity_name, location, class_id, guru_id, description } = data;
    if (!day || !time_start || !activity_name) {
      const err = new Error('Hari, jam mulai, dan nama kegiatan wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const [id] = await db('schedules').insert({
      tenant_id: tenantId,
      class_id: class_id || null,
      guru_id: guru_id || null,
      day,
      time_start,
      time_end: time_end || '',
      activity_name,
      location: location || 'Masjid Utama',
      description: description || null,
    });

    return db('schedules').where({ id }).first();
  }

  async updateSchedule(id, tenantId, data) {
    const { day, time_start, time_end, activity_name, location, class_id, guru_id, description } = data;
    const updatePayload = { updated_at: db.fn.now() };
    if (day) updatePayload.day = day;
    if (time_start) updatePayload.time_start = time_start;
    if (time_end !== undefined) updatePayload.time_end = time_end;
    if (activity_name) updatePayload.activity_name = activity_name;
    if (location !== undefined) updatePayload.location = location;
    if (class_id !== undefined) updatePayload.class_id = class_id;
    if (guru_id !== undefined) updatePayload.guru_id = guru_id;
    if (description !== undefined) updatePayload.description = description;

    await db('schedules').where({ id, tenant_id: tenantId }).update(updatePayload);
    return db('schedules').where({ id }).first();
  }

  async deleteSchedule(id, tenantId) {
    await db('schedules').where({ id, tenant_id: tenantId }).del();
    return true;
  }
}

module.exports = new SchedulesService();
