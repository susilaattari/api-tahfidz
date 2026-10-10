const db = require('../../config/database');

class AttendanceService {
  /**
   * Catat atau perbarui absensi halaqah (single atau bulk per santri)
   */
  async recordAttendance(tenantId, guruId, data) {
    const { class_id, date, attendances } = data;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Jika bulk (array)
    if (Array.isArray(attendances) && attendances.length > 0) {
      const results = [];
      for (const item of attendances) {
        const { santri_id, status, notes } = item;
        if (!santri_id) continue;

        const validStatus = ['hadir', 'sakit', 'izin', 'alpa'].includes(status) ? status : 'hadir';

        const existing = await db('attendances')
          .where({
            tenant_id: tenantId,
            santri_id,
            date: targetDate,
          })
          .first();

        if (existing) {
          await db('attendances')
            .where({ id: existing.id })
            .update({
              status: validStatus,
              notes: notes !== undefined ? notes : existing.notes,
              guru_id: guruId || existing.guru_id,
              class_id: class_id || existing.class_id,
              updated_at: db.fn.now(),
            });
          results.push({ id: existing.id, santri_id, status: validStatus, date: targetDate });
        } else {
          const [id] = await db('attendances').insert({
            tenant_id: tenantId,
            class_id: class_id || null,
            santri_id,
            guru_id: guruId || null,
            date: targetDate,
            status: validStatus,
            notes: notes || null,
          });
          results.push({ id, santri_id, status: validStatus, date: targetDate });
        }
      }
      return results;
    }

    // Jika single
    const { santri_id, status, notes } = data;
    if (!santri_id) {
      const err = new Error('santri_id wajib disertakan.');
      err.statusCode = 400;
      throw err;
    }

    const validStatus = ['hadir', 'sakit', 'izin', 'alpa'].includes(status) ? status : 'hadir';
    const existing = await db('attendances')
      .where({
        tenant_id: tenantId,
        santri_id,
        date: targetDate,
      })
      .first();

    if (existing) {
      await db('attendances')
        .where({ id: existing.id })
        .update({
          status: validStatus,
          notes: notes !== undefined ? notes : existing.notes,
          guru_id: guruId || existing.guru_id,
          class_id: class_id || existing.class_id,
          updated_at: db.fn.now(),
        });
      return { id: existing.id, santri_id, status: validStatus, date: targetDate };
    }

    const [id] = await db('attendances').insert({
      tenant_id: tenantId,
      class_id: class_id || null,
      santri_id,
      guru_id: guruId || null,
      date: targetDate,
      status: validStatus,
      notes: notes || null,
    });

    return { id, santri_id, status: validStatus, date: targetDate };
  }

  /**
   * Ambil absensi berdasarkan kelas dan tanggal
   */
  async getByClassAndDate(tenantId, classId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Ambil semua santri di kelas tersebut
    let santriQuery = db('santri').where({ tenant_id: tenantId });
    if (classId) {
      santriQuery = santriQuery.where({ class_id: classId });
    }
    const santriList = await santriQuery.select('id', 'full_name', 'nisn', 'gender', 'class_id');

    // Ambil absensi pada tanggal tersebut
    const attendanceRecords = await db('attendances')
      .where({ tenant_id: tenantId, date: targetDate })
      .select('*');

    const attMap = {};
    attendanceRecords.forEach((r) => {
      attMap[r.santri_id] = r;
    });

    // Gabungkan santri dengan status absensi
    const combined = santriList.map((s) => {
      const rec = attMap[s.id];
      return {
        santri_id: s.id,
        full_name: s.full_name,
        nisn: s.nisn,
        class_id: s.class_id,
        date: targetDate,
        status: rec ? rec.status : 'hadir', // Default hadir jika belum diisi
        is_recorded: !!rec,
        notes: rec ? rec.notes : null,
        attendance_id: rec ? rec.id : null,
      };
    });

    const summary = {
      total_santri: santriList.length,
      hadir: combined.filter((c) => c.status === 'hadir').length,
      sakit: combined.filter((c) => c.status === 'sakit').length,
      izin: combined.filter((c) => c.status === 'izin').length,
      alpa: combined.filter((c) => c.status === 'alpa').length,
    };

    return {
      date: targetDate,
      class_id: classId,
      summary,
      items: combined,
    };
  }

  /**
   * Riwayat absensi per santri (untuk Wali Santri atau Guru)
   */
  async getBySantri(tenantId, santriId, query = {}) {
    const { limit = 30 } = query;

    const santri = await db('santri').where({ id: santriId, tenant_id: tenantId }).first();
    if (!santri) {
      const err = new Error('Santri tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const records = await db('attendances')
      .where({ tenant_id: tenantId, santri_id: santriId })
      .orderBy('date', 'desc')
      .limit(Number(limit));

    const total = records.length;
    const hadir = records.filter((r) => r.status === 'hadir').length;
    const sakit = records.filter((r) => r.status === 'sakit').length;
    const izin = records.filter((r) => r.status === 'izin').length;
    const alpa = records.filter((r) => r.status === 'alpa').length;
    const persenKehadiran = total > 0 ? Math.round((hadir / total) * 100) : 100;

    return {
      santri: {
        id: santri.id,
        full_name: santri.full_name,
        nisn: santri.nisn,
      },
      summary: {
        total,
        hadir,
        sakit,
        izin,
        alpa,
        persenKehadiran,
      },
      records,
    };
  }

  /**
   * Rekap riwayat tanggal absensi halaqah (untuk Guru melihat arsip tanggal absensi)
   */
  async getHistoryDates(tenantId, classId, query = {}) {
    const { limit = 30 } = query;

    let q = db('attendances')
      .where({ tenant_id: tenantId })
      .groupBy('date')
      .select('date')
      .count('id as total_santri')
      .sum({ hadir: db.raw("CASE WHEN status = 'hadir' THEN 1 ELSE 0 END") })
      .sum({ sakit: db.raw("CASE WHEN status = 'sakit' THEN 1 ELSE 0 END") })
      .sum({ izin: db.raw("CASE WHEN status = 'izin' THEN 1 ELSE 0 END") })
      .sum({ alpa: db.raw("CASE WHEN status = 'alpa' THEN 1 ELSE 0 END") })
      .orderBy('date', 'desc')
      .limit(Number(limit));

    if (classId) {
      q = q.where({ class_id: classId });
    }

    const rows = await q;
    return rows.map((r) => ({
      date: r.date,
      total_santri: Number(r.total_santri || 0),
      hadir: Number(r.hadir || 0),
      sakit: Number(r.sakit || 0),
      izin: Number(r.izin || 0),
      alpa: Number(r.alpa || 0),
    }));
  }
}

module.exports = new AttendanceService();
