const db = require('../../config/database');

function parseMaterial(mat) {
  if (!mat) return null;
  let metadata = {};
  if (mat.description) {
    try {
      if (typeof mat.description === 'string' && (mat.description.trim().startsWith('{') || mat.description.trim().startsWith('['))) {
        metadata = JSON.parse(mat.description);
      }
    } catch (e) {
      // plain text description
    }
  }

  const authorName = mat.author_name || mat.creator_user_name || (mat.is_global ? 'Super Administrator' : 'Pengajar Institusi');
  const roleName = mat.creator_user_role === 'super_admin'
    ? 'Super Admin (Pusat)'
    : mat.creator_user_role === 'admin_tenant'
    ? 'Admin Institusi'
    : mat.creator_user_role === 'guru'
    ? 'Guru / Pengajar'
    : mat.is_global
    ? 'Super Admin (Pusat)'
    : 'Admin Institusi';

  return {
    ...mat,
    author_name: authorName,
    creator_role: roleName,
    tenant_name: mat.tenant_name || (mat.is_global ? 'Pusat Kurikulum Global' : 'Institusi'),
    metadata,
  };
}

class LmsService {
  async getMaterials(tenantId, options = {}) {
    // Return global materials, or tenant-specific materials + global
    let query = db('lms_materials')
      .leftJoin('users', 'lms_materials.created_by', 'users.id')
      .leftJoin('tenants', 'lms_materials.tenant_id', 'tenants.id')
      .select(
        'lms_materials.*',
        'users.name as creator_user_name',
        'users.role as creator_user_role',
        'tenants.name as tenant_name'
      )
      .orderBy('lms_materials.created_at', 'desc');

    if (options.is_global) {
      query = query.where('lms_materials.is_global', true);
    } else if (tenantId) {
      query = query.where((builder) => {
        builder.where('lms_materials.is_global', true).orWhere('lms_materials.tenant_id', tenantId);
      });
    }

    const materials = await query;
    return materials.map(parseMaterial);
  }

  async getMaterialById(id) {
    const mat = await db('lms_materials')
      .leftJoin('users', 'lms_materials.created_by', 'users.id')
      .leftJoin('tenants', 'lms_materials.tenant_id', 'tenants.id')
      .select(
        'lms_materials.*',
        'users.name as creator_user_name',
        'users.role as creator_user_role',
        'tenants.name as tenant_name'
      )
      .where('lms_materials.id', id)
      .first();

    if (!mat) {
      const err = new Error('Materi LMS tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    return parseMaterial(mat);
  }

  async createMaterial(tenantId, data, isGlobal = false, user = null) {
    const { title, description, type, content_url } = data;
    if (!title) {
      const err = new Error('Judul materi wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const effectiveUrl = content_url || '#';
    const descString = typeof description === 'object' ? JSON.stringify(description) : (description || null);

    const [id] = await db('lms_materials').insert({
      tenant_id: isGlobal ? null : tenantId,
      created_by: user ? user.id : null,
      author_name: user ? user.name : (isGlobal ? 'Super Administrator' : null),
      title,
      description: descString,
      type: type || 'video',
      content_url: effectiveUrl,
      is_global: Boolean(isGlobal),
    });

    return this.getMaterialById(id);
  }

  async updateMaterial(id, tenantId, data, isSuperAdmin = false) {
    const { title, description, type, content_url, is_global } = data;
    const updatePayload = {};
    if (title) updatePayload.title = title;
    if (description !== undefined) {
      updatePayload.description = typeof description === 'object' ? JSON.stringify(description) : description;
    }
    if (type) updatePayload.type = type;
    if (content_url !== undefined) updatePayload.content_url = content_url || '#';
    if (isSuperAdmin && is_global !== undefined) {
      updatePayload.is_global = Boolean(is_global);
    }
    updatePayload.updated_at = db.fn.now();

    let query = db('lms_materials').where({ id });
    if (!isSuperAdmin && tenantId) {
      query = query.where({ tenant_id: tenantId });
    }

    await query.update(updatePayload);
    return this.getMaterialById(id);
  }

  async deleteMaterial(id, tenantId, isSuperAdmin = false) {
    let query = db('lms_materials').where({ id });
    if (!isSuperAdmin && tenantId) {
      query = query.where({ tenant_id: tenantId });
    }
    await query.del();
    return true;
  }
}

module.exports = new LmsService();
