const bcrypt = require('bcryptjs');
const db = require('../../config/database');

class UsersService {
  async getUsersByTenant(tenantId, role = null, options = {}) {
    const {
      search = '',
      page = 1,
      per_page: perPage = 10,
      paginated = false,
    } = options;

    let query = db('users')
      .leftJoin('tenants', 'users.tenant_id', 'tenants.id')
      .select(
        'users.id',
        'users.tenant_id',
        'users.name',
        'users.email',
        'users.phone',
        'users.role',
        'users.status',
        'users.can_create_lms_local',
        'users.can_create_lms_global',
        'users.created_at',
        'tenants.name as tenant_name'
      );

    if (tenantId) {
      query = query.where({ 'users.tenant_id': tenantId });
    }
    if (role) {
      query = query.where({ 'users.role': role });
    }

    const cleanSearch = String(search || '').trim().toLowerCase();
    if (cleanSearch) {
      query = query.where((builder) => {
        builder
          .whereRaw('LOWER(users.name) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(users.email) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(COALESCE(users.phone, \'\')) LIKE ?', [`%${cleanSearch}%`]);
      });
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(perPage) || 10));
    let total = null;

    if (paginated) {
      const totalRow = await query.clone().clearSelect().clearOrder().count({ count: 'users.id' }).first();
      total = Number(totalRow?.count || 0);
      query = query.limit(pageSize).offset((pageNum - 1) * pageSize);
    }

    const results = await query.orderBy('users.created_at', 'desc');
    const items = results.map((u) => ({
      ...u,
      can_create_lms_local: Boolean(u.can_create_lms_local),
      can_create_lms_global: Boolean(u.can_create_lms_global),
    }));

    return paginated ? { items, total, page: pageNum, per_page: pageSize } : items;
  }

  async getUserById(id, tenantId = null) {
    let query = db('users').where({ id });
    if (tenantId) {
      query = query.where({ tenant_id: tenantId });
    }
    const user = await query.first();
    if (!user) {
      const err = new Error('Pengguna tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    delete user.password_hash;
    return {
      ...user,
      can_create_lms_local: Boolean(user.can_create_lms_local),
      can_create_lms_global: Boolean(user.can_create_lms_global),
    };
  }

  async createUser(tenantId, data) {
    const { name, email, phone, password, role, can_create_lms_local } = data;
    if (!name || !email || !password || !role) {
      const err = new Error('Nama, email, password, dan peran wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      const err = new Error('Email sudah terdaftar dalam sistem.');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      tenant_id: tenantId,
      name,
      email,
      phone: phone || null,
      password_hash: passwordHash,
      role,
      status: 'active',
      can_create_lms_local: can_create_lms_local ? true : false,
      can_create_lms_global: false,
    });

    return this.getUserById(id, tenantId);
  }

  async updateUser(id, tenantId, data, isSuperAdmin = false) {
    const { name, phone, password, status, can_create_lms_local, can_create_lms_global } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (phone !== undefined) updatePayload.phone = phone;
    if (status) updatePayload.status = status;
    if (password) {
      updatePayload.password_hash = await bcrypt.hash(password, 10);
    }
    // Tenant Admin or Super Admin can set local LMS permission for teachers
    if (can_create_lms_local !== undefined) {
      updatePayload.can_create_lms_local = Boolean(can_create_lms_local);
    }
    // Only Super Admin can grant global LMS contributor permission
    if (isSuperAdmin && can_create_lms_global !== undefined) {
      updatePayload.can_create_lms_global = Boolean(can_create_lms_global);
    }
    updatePayload.updated_at = db.fn.now();

    let query = db('users').where({ id });
    if (!isSuperAdmin && tenantId) {
      query = query.where({ tenant_id: tenantId });
    }
    await query.update(updatePayload);
    return this.getUserById(id, isSuperAdmin ? null : tenantId);
  }

  async deleteUser(id, tenantId) {
    await db('users').where({ id, tenant_id: tenantId }).del();
    return true;
  }
}

module.exports = new UsersService();
