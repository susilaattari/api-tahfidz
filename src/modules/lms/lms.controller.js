const lmsService = require('./lms.service');
const { successResponse, errorResponse } = require('../../utils/response.util');

class LmsController {
  async getAll(req, res, next) {
    try {
      const isSuperAdmin = req.user.role === 'super_admin';
      const isGlobal = req.query.is_global === 'true' || req.query.is_global === true;
      const tenantId = isSuperAdmin ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const materials = await lmsService.getMaterials(tenantId, { is_global: isGlobal });
      return successResponse(res, 'Materi pembelajaran LMS berhasil diambil.', materials);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const mat = await lmsService.getMaterialById(req.params.id);
      return successResponse(res, 'Detail materi LMS berhasil diambil.', mat);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = req.user;
      let isGlobal = false;
      let tenantId = user.tenant_id;

      if (user.role === 'super_admin') {
        isGlobal = req.body.is_global !== undefined ? Boolean(req.body.is_global) : true;
        tenantId = isGlobal ? null : (req.body.tenant_id || null);
      } else if (user.role === 'admin_tenant') {
        if (req.body.is_global) {
          return errorResponse(res, 'Akses ditolak: Hanya Super Admin yang dapat membuat materi LMS global.', 403);
        }
        isGlobal = false;
        tenantId = user.tenant_id;
      } else if (user.role === 'guru') {
        if (req.body.is_global) {
          if (!user.can_create_lms_global) {
            return errorResponse(res, 'Akses ditolak: Anda belum diberikan izin oleh Super Admin untuk membuat materi LMS global.', 403);
          }
          isGlobal = true;
          tenantId = null;
        } else {
          if (!user.can_create_lms_local) {
            return errorResponse(res, 'Akses ditolak: Anda belum diberikan izin oleh Admin Institusi untuk membuat materi LMS lokal.', 403);
          }
          isGlobal = false;
          tenantId = user.tenant_id;
        }
      } else {
        return errorResponse(res, 'Akses ditolak.', 403);
      }

      const created = await lmsService.createMaterial(tenantId, req.body, isGlobal, user);
      return successResponse(res, 'Materi LMS berhasil ditambahkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const user = req.user;
      const existing = await lmsService.getMaterialById(req.params.id);

      if (user.role === 'super_admin') {
        // Super Admin has full update access
      } else if (user.role === 'admin_tenant') {
        if (existing.is_global) {
          return errorResponse(res, 'Materi kurikulum global hanya dapat diubah oleh Super Admin.', 403);
        }
        if (existing.tenant_id !== user.tenant_id) {
          return errorResponse(res, 'Akses ditolak ke materi institusi lain.', 403);
        }
      } else if (user.role === 'guru') {
        if (existing.is_global) {
          if (!user.can_create_lms_global) {
            return errorResponse(res, 'Akses ditolak: Anda tidak memiliki izin kontributor LMS global.', 403);
          }
          if (existing.created_by !== user.id) {
            return errorResponse(res, 'Anda hanya dapat mengedit materi global yang Anda buat sendiri.', 403);
          }
        } else {
          if (!user.can_create_lms_local) {
            return errorResponse(res, 'Akses ditolak: Anda belum diberikan izin oleh Admin Institusi untuk mengelola materi LMS lokal.', 403);
          }
          if (existing.tenant_id !== user.tenant_id) {
            return errorResponse(res, 'Akses ditolak ke materi institusi lain.', 403);
          }
        }
      } else {
        return errorResponse(res, 'Akses ditolak.', 403);
      }

      const isSuperAdmin = user.role === 'super_admin';
      const updated = await lmsService.updateMaterial(req.params.id, existing.tenant_id, req.body, isSuperAdmin);
      return successResponse(res, 'Materi LMS berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const user = req.user;
      const existing = await lmsService.getMaterialById(req.params.id);

      if (user.role === 'super_admin') {
        // Super admin has full delete access
      } else if (user.role === 'admin_tenant') {
        if (existing.is_global) {
          return errorResponse(res, 'Materi kurikulum global hanya dapat dihapus oleh Super Admin.', 403);
        }
        if (existing.tenant_id !== user.tenant_id) {
          return errorResponse(res, 'Akses ditolak ke materi institusi lain.', 403);
        }
      } else if (user.role === 'guru') {
        if (existing.is_global) {
          if (!user.can_create_lms_global || existing.created_by !== user.id) {
            return errorResponse(res, 'Akses ditolak: Anda tidak berwenang menghapus materi global ini.', 403);
          }
        } else {
          if (!user.can_create_lms_local) {
            return errorResponse(res, 'Akses ditolak: Anda belum diberikan izin oleh Admin Institusi untuk mengelola materi LMS lokal.', 403);
          }
          if (existing.tenant_id !== user.tenant_id) {
            return errorResponse(res, 'Akses ditolak ke materi institusi lain.', 403);
          }
        }
      } else {
        return errorResponse(res, 'Akses ditolak.', 403);
      }

      const isSuperAdmin = user.role === 'super_admin';
      await lmsService.deleteMaterial(req.params.id, existing.tenant_id, isSuperAdmin);
      return successResponse(res, 'Materi LMS berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LmsController();
