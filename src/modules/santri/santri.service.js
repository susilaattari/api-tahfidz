const bcrypt = require('bcryptjs');
const db = require('../../config/database');

class SantriService {
  async getSantriByTenant(tenantId, options = {}) {
    const {
      class_id: classId,
      search = '',
      page = 1,
      per_page: perPage = 10,
      paginated = false,
    } = options;

    let query = db('santri')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .leftJoin('users as wali', 'santri.wali_id', 'wali.id')
      .where('santri.tenant_id', tenantId)
      .select(
        'santri.*',
        'classes.name as class_name',
        'wali.name as wali_name',
        'wali.email as wali_email',
        'wali.phone as wali_phone'
      );

    if (classId) {
      query = query.where('santri.class_id', classId);
    }

    const cleanSearch = String(search || '').trim().toLowerCase();
    if (cleanSearch) {
      query = query.where((builder) => {
        builder
          .whereRaw('LOWER(santri.full_name) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(COALESCE(santri.nisn, \'\')) LIKE ?', [`%${cleanSearch}%`]);
      });
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(perPage) || 10));
    let total = null;

    if (paginated) {
      const totalRow = await query.clone().clearSelect().clearOrder().count({ count: 'santri.id' }).first();
      total = Number(totalRow?.count || 0);
      query = query.limit(pageSize).offset((pageNum - 1) * pageSize);
    }

    const list = await query.orderBy('santri.full_name', 'asc');
    const items = list.map((item) => ({
      ...item,
      name: item.name || item.full_name,
      nis: item.nis || item.nisn,
      kelas: typeof item.kelas === 'object' ? item.kelas : { id: item.class_id, name: item.class_name || 'Halaqah' },
      wali_santri: item.wali_name,
    }));

    return paginated ? { items, total, page: pageNum, per_page: pageSize } : items;
  }

  async getSantriById(id, tenantId) {
    const santri = await db('santri')
      .leftJoin('classes', 'santri.class_id', 'classes.id')
      .leftJoin('users as wali', 'santri.wali_id', 'wali.id')
      .where({ 'santri.id': id, 'santri.tenant_id': tenantId })
      .select(
        'santri.*',
        'classes.name as class_name',
        'wali.name as wali_name',
        'wali.email as wali_email',
        'wali.phone as wali_phone'
      )
      .first();

    if (!santri) {
      const err = new Error('Santri tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    // Attach recent hafalan & badges
    const recentHafalan = await db('hafalan_histories')
      .where({ santri_id: id })
      .orderBy('date_recorded', 'desc')
      .limit(5);

    const badges = await db('badges')
      .where({ santri_id: id })
      .orderBy('awarded_at', 'desc');

    return {
      ...santri,
      name: santri.name || santri.full_name,
      nis: santri.nis || santri.nisn,
      kelas: typeof santri.kelas === 'object' ? santri.kelas : { id: santri.class_id, name: santri.class_name || 'Halaqah' },
      wali_santri: santri.wali_name,
      recent_hafalan: recentHafalan.map((h) => ({
        ...h,
        surah: h.surah || h.surah_name,
        ayat_mulai: h.ayat_mulai || h.verse_start,
        ayat_selesai: h.ayat_selesai || h.verse_end,
        nilai: h.nilai || h.grade,
      })),
      badges,
    };
  }


  async createSantri(tenantId, data) {
    let { wali_id, class_id, nisn, full_name, gender, total_juz_hafalan, email, phone, password, create_account } = data;
    if (!full_name) {
      const err = new Error('Nama lengkap santri wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    // Enforce tenant max_santri package quota (or requested_santri_count if additional quota was purchased)
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.id', tenantId)
      .select('packages.max_santri', 'tenants.requested_santri_count')
      .first();

    const maxAllowed = Math.max(Number(tenant?.requested_santri_count || 0), Number(tenant?.max_santri || 10));
    const currentCount = await db('santri').where({ tenant_id: tenantId }).count('id as count').first();
    if (Number(currentCount?.count || 0) >= maxAllowed) {
      const err = new Error(`Batas kuota santri (${maxAllowed}) untuk paket ini telah tercapai. Silakan tambah kuota santri atau upgrade paket.`);
      err.statusCode = 403;
      throw err;
    }

    // Auto-create user login account for non-pesantren / independent learner
    if ((create_account || email) && !wali_id) {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const existingUser = await db('users').where({ email: cleanEmail }).first();
        if (existingUser) {
          wali_id = existingUser.id;
        } else {
          const rawPassword = password || 'password123';
          const password_hash = await bcrypt.hash(rawPassword, 10);
          const [newUserId] = await db('users').insert({
            tenant_id: tenantId,
            name: full_name,
            email: cleanEmail,
            phone: phone ? phone.trim() : null,
            password_hash,
            role: 'wali_santri', // mapped to mobile user/member view
            status: 'active',
          });
          wali_id = newUserId;
        }
      }
    }

    const [id] = await db('santri').insert({
      tenant_id: tenantId,
      wali_id: wali_id || null,
      class_id: class_id || null,
      nisn: nisn || null,
      full_name,
      gender: gender || 'L',
      total_juz_hafalan: total_juz_hafalan || 0,
    });

    return this.getSantriById(id, tenantId);
  }

  async updateSantri(id, tenantId, data) {
    const { wali_id, class_id, nisn, full_name, gender, total_juz_hafalan } = data;
    const updatePayload = {};
    if (wali_id !== undefined) updatePayload.wali_id = wali_id;
    if (class_id !== undefined) updatePayload.class_id = class_id;
    if (nisn !== undefined) updatePayload.nisn = nisn;
    if (full_name) updatePayload.full_name = full_name;
    if (gender) updatePayload.gender = gender;
    if (total_juz_hafalan !== undefined) updatePayload.total_juz_hafalan = total_juz_hafalan;
    updatePayload.updated_at = db.fn.now();

    await db('santri').where({ id, tenant_id: tenantId }).update(updatePayload);
    return this.getSantriById(id, tenantId);
  }

  async deleteSantri(id, tenantId) {
    await db('santri').where({ id, tenant_id: tenantId }).del();
    return true;
  }
}

module.exports = new SantriService();
