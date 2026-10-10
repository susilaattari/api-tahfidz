const db = require('../../config/database');

class ClassesService {
  async getClassesByTenant(tenantId) {
    const classes = await db('classes')
      .leftJoin('users', 'classes.guru_id', 'users.id')
      .where('classes.tenant_id', tenantId)
      .select('classes.*', 'users.name as guru_name', 'users.email as guru_email')
      .orderBy('classes.name', 'asc');

    const classesWithStats = await Promise.all(
      classes.map(async (c) => {
        const santriCount = await db('santri').where({ class_id: c.id }).count('id as count').first();
        return {
          ...c,
          total_santri: Number(santriCount?.count || 0),
        };
      })
    );

    return classesWithStats;
  }

  async getClassById(id, tenantId) {
    const classData = await db('classes')
      .leftJoin('users', 'classes.guru_id', 'users.id')
      .where({ 'classes.id': id, 'classes.tenant_id': tenantId })
      .select('classes.*', 'users.name as guru_name')
      .first();

    if (!classData) {
      const err = new Error('Kelas tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    return classData;
  }

  async createClass(tenantId, data) {
    const { name, guru_id, academic_year } = data;
    if (!name) {
      const err = new Error('Nama kelas wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const [id] = await db('classes').insert({
      tenant_id: tenantId,
      guru_id: guru_id || null,
      name,
      academic_year: academic_year || '2026/2027',
    });

    return this.getClassById(id, tenantId);
  }

  async updateClass(id, tenantId, data) {
    const { name, guru_id, academic_year } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (guru_id !== undefined) updatePayload.guru_id = guru_id;
    if (academic_year) updatePayload.academic_year = academic_year;
    updatePayload.updated_at = db.fn.now();

    await db('classes').where({ id, tenant_id: tenantId }).update(updatePayload);
    return this.getClassById(id, tenantId);
  }

  async deleteClass(id, tenantId) {
    await db('classes').where({ id, tenant_id: tenantId }).del();
    return true;
  }
}

module.exports = new ClassesService();
