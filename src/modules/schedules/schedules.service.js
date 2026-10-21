const db = require('../../config/database');

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const validateDay = (day) => {
  if (!day || !DAYS.includes(day)) {
    throw httpError('Hari jadwal tidak valid.');
  }
};

const validateTime = (time, label) => {
  if (!time || !TIME_REGEX.test(time)) {
    throw httpError(`${label} harus menggunakan format HH:MM.`);
  }
};

const validateTimeRange = (start, end) => {
  validateTime(start, 'Jam mulai');
  if (end) {
    validateTime(end, 'Jam selesai');
    if (end <= start) {
      throw httpError('Jam selesai harus setelah jam mulai.');
    }
  }
};

class SchedulesService {
  async _getClass(tenantId, classId) {
    const id = Number(classId);
    if (!Number.isInteger(id) || id < 1) {
      throw httpError('Kelas/halaqah wajib dipilih.');
    }

    const classData = await db('classes')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!classData) {
      throw httpError('Kelas/halaqah tidak ditemukan pada institusi ini.', 404);
    }

    return classData;
  }

  async _validateGuru(tenantId, guruId) {
    if (guruId === undefined || guruId === null || guruId === '') return null;
    const id = Number(guruId);
    if (!Number.isInteger(id) || id < 1) {
      throw httpError('Guru pembimbing tidak valid.');
    }

    const guru = await db('users')
      .where({ id, tenant_id: tenantId })
      .whereIn('role', ['guru', 'admin_tenant'])
      .first();

    if (!guru) {
      throw httpError('Guru pembimbing tidak ditemukan pada institusi ini.', 404);
    }
    return guru.id;
  }

  async _getGuruClassIds(tenantId, userId) {
    return db('classes')
      .where({ tenant_id: tenantId, guru_id: userId })
      .pluck('id');
  }

  async _getWaliClassIds(tenantId, userId, santriId = null) {
    let query = db('santri')
      .where({ tenant_id: tenantId, wali_id: userId });

    if (santriId) {
      const id = Number(santriId);
      if (!Number.isInteger(id) || id < 1) {
        throw httpError('Data anak tidak valid.');
      }
      query = query.where('id', id);
    }

    const santris = await query.select('id', 'class_id', 'full_name');
    if (santriId && santris.length === 0) {
      throw httpError('Data anak tidak ditemukan atau bukan tanggungan Anda.', 403);
    }

    return {
      santris,
      classIds: [...new Set(santris.map((s) => s.class_id).filter(Boolean))],
    };
  }

  async getSchedules(user, tenantId, query = {}) {
    const { day, class_id } = query;

    let q = db('schedules')
      .leftJoin('users', 'schedules.guru_id', 'users.id')
      .leftJoin('classes', 'schedules.class_id', 'classes.id')
      .where('schedules.tenant_id', tenantId)
      .select(
        'schedules.*',
        'users.name as guru_name',
        'classes.name as class_name',
        'classes.guru_id as class_guru_id'
      );

    if (user.role === 'wali_santri') {
      const { classIds } = await this._getWaliClassIds(
        tenantId,
        user.id,
        query.santri_id || null
      );

      if (classIds.length === 0) return [];
      q.whereIn('schedules.class_id', classIds);
    } else if (user.role === 'guru') {
      const classIds = await this._getGuruClassIds(tenantId, user.id);
      q.whereNotNull('schedules.class_id').where((builder) => {
        if (classIds.length > 0) {
          builder.whereIn('schedules.class_id', classIds);
        }
        builder.orWhere('schedules.guru_id', user.id);
      });
    }

    if (day) q.where('schedules.day', day);
    if (class_id === 'unassigned') {
      q.whereNull('schedules.class_id');
    } else if (class_id) {
      const id = Number(class_id);
      if (!Number.isInteger(id) || id < 1) {
        throw httpError('Filter kelas tidak valid.');
      }
      q.where('schedules.class_id', id);
    }

    const schedules = await q;

    schedules.sort((a, b) => {
      const orderA = DAYS.indexOf(a.day);
      const orderB = DAYS.indexOf(b.day);
      if (orderA !== orderB) return orderA - orderB;
      return String(a.time_start).localeCompare(String(b.time_start));
    });

    return schedules;
  }

  async createSchedule(user, tenantId, data) {
    const { day, time_start, time_end, activity_name, location, description } = data;

    validateDay(day);
    validateTimeRange(time_start, time_end);

    if (!activity_name || !String(activity_name).trim()) {
      throw httpError('Nama kegiatan wajib diisi.');
    }

    const classData = await this._getClass(tenantId, data.class_id);

    if (user.role === 'guru' && Number(classData.guru_id) !== Number(user.id)) {
      throw httpError('Anda hanya dapat menambah jadwal untuk halaqah yang Anda ampu.', 403);
    }

    let guru_id = await this._validateGuru(tenantId, data.guru_id);
    if (user.role === 'guru') guru_id = user.id;
    if (!guru_id && classData.guru_id) guru_id = classData.guru_id;

    const [id] = await db('schedules').insert({
      tenant_id: tenantId,
      class_id: classData.id,
      guru_id: guru_id || null,
      day,
      time_start,
      time_end: time_end || '',
      activity_name: String(activity_name).trim(),
      location: location ? String(location).trim() : 'Masjid Utama',
      description: description ? String(description).trim() : null,
    });

    return db('schedules').where({ id }).first();
  }

  async updateSchedule(user, id, tenantId, data) {
    const schedule = await db('schedules')
      .where({ id: Number(id), tenant_id: tenantId })
      .first();

    if (!schedule) throw httpError('Jadwal tidak ditemukan.', 404);

    if (user.role === 'guru') {
      const classIds = await this._getGuruClassIds(tenantId, user.id);
      const canEdit =
        (schedule.class_id && classIds.includes(schedule.class_id)) ||
        Number(schedule.guru_id) === Number(user.id);
      if (!canEdit) {
        throw httpError('Anda hanya dapat mengubah jadwal halaqah yang Anda ampu.', 403);
      }
    }

    const nextClassId = data.class_id !== undefined ? data.class_id : schedule.class_id;
    const classData = await this._getClass(tenantId, nextClassId);

    if (user.role === 'guru' && Number(classData.guru_id) !== Number(user.id)) {
      throw httpError('Anda hanya dapat mengubah jadwal untuk halaqah yang Anda ampu.', 403);
    }

    const nextDay = data.day !== undefined ? data.day : schedule.day;
    const nextStart = data.time_start !== undefined ? data.time_start : schedule.time_start;
    const nextEnd = data.time_end !== undefined ? data.time_end : schedule.time_end;
    const nextActivity =
      data.activity_name !== undefined ? data.activity_name : schedule.activity_name;

    validateDay(nextDay);
    validateTimeRange(nextStart, nextEnd);
    if (!nextActivity || !String(nextActivity).trim()) {
      throw httpError('Nama kegiatan wajib diisi.');
    }

    let guru_id = schedule.guru_id;
    if (data.guru_id !== undefined) {
      guru_id = await this._validateGuru(tenantId, data.guru_id);
    }
    if (!guru_id && classData.guru_id) guru_id = classData.guru_id;
    if (user.role === 'guru') guru_id = user.id;

    const updatePayload = {
      class_id: classData.id,
      guru_id: guru_id || null,
      day: nextDay,
      time_start: nextStart,
      time_end: nextEnd || '',
      activity_name: String(nextActivity).trim(),
      location:
        data.location !== undefined
          ? data.location
            ? String(data.location).trim()
            : 'Masjid Utama'
          : schedule.location,
      description:
        data.description !== undefined
          ? data.description
            ? String(data.description).trim()
            : null
          : schedule.description,
      updated_at: db.fn.now(),
    };

    await db('schedules').where({ id: schedule.id }).update(updatePayload);
    return db('schedules').where({ id: schedule.id }).first();
  }

  async deleteSchedule(user, id, tenantId) {
    const schedule = await db('schedules')
      .where({ id: Number(id), tenant_id: tenantId })
      .first();

    if (!schedule) throw httpError('Jadwal tidak ditemukan.', 404);

    if (user.role === 'guru') {
      const classIds = await this._getGuruClassIds(tenantId, user.id);
      const canDelete =
        (schedule.class_id && classIds.includes(schedule.class_id)) ||
        Number(schedule.guru_id) === Number(user.id);
      if (!canDelete) {
        throw httpError('Anda hanya dapat menghapus jadwal halaqah yang Anda ampu.', 403);
      }
    }

    await db('schedules').where({ id: schedule.id }).delete();
    return true;
  }
}

module.exports = new SchedulesService();
