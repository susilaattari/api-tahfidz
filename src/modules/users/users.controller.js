const usersService = require('./users.service');
const { successResponse } = require('../../utils/response.util');

class UsersController {
  async getAll(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const role = req.query.role || null;
      const users = await usersService.getUsersByTenant(tenantId, role);
      return successResponse(res, 'Data pengguna berhasil diambil.', users);
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
