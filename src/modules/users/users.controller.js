const usersService = require('./users.service');
const { successResponse } = require('../../utils/response.util');

class UsersController {
  async getAll(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const role = req.query.role || null;
      const paginated = req.query.paginated === 'true' || req.query.paginated === '1';
      const result = await usersService.getUsersByTenant(tenantId, role, {
        search: req.query.search || '',
        page: req.query.page,
        per_page: req.query.per_page,
        paginated,
      });

      if (paginated) {
        const { items, total, page, per_page } = result;
        return successResponse(res, 'Data pengguna berhasil diambil.', items, 200, {
          pagination: { page, per_page, total, total_pages: Math.max(1, Math.ceil(total / per_page)) },
        });
      }

      return successResponse(res, 'Data pengguna berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? null : req.user.tenant_id;
      const user = await usersService.getUserById(req.params.id, tenantId);
      return successResponse(res, 'Detail pengguna berhasil diambil.', user);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const created = await usersService.createUser(tenantId, req.body);
      return successResponse(res, 'Pengguna berhasil ditambahkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const isSuperAdmin = req.user.role === 'super_admin';
      const tenantId = isSuperAdmin ? null : req.user.tenant_id;
      const updated = await usersService.updateUser(req.params.id, tenantId, req.body, isSuperAdmin);
      return successResponse(res, 'Data pengguna berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? null : req.user.tenant_id;
      await usersService.deleteUser(req.params.id, tenantId);
      return successResponse(res, 'Pengguna berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();
