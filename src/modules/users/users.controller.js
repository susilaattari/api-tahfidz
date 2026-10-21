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

  async savePushToken(req, res, next) {
    try {
      const notificationService = require('../../services/notification.service');
      const { token, device_type } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Push token wajib disertakan.' });
      }
      const saved = await notificationService.saveToken(req.user.id, token, device_type || 'mobile');
      return successResponse(res, 'Token notifikasi berhasil didaftarkan.', saved);
    } catch (error) {
      next(error);
    }
  }

  async removePushToken(req, res, next) {
    try {
      const notificationService = require('../../services/notification.service');
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Token wajib disertakan.' });
      }
      await notificationService.removeToken(req.user.id, token);
      return successResponse(res, 'Token notifikasi berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }

  async sendTestNotification(req, res, next) {
    try {
      const notificationService = require('../../services/notification.service');
      const result = await notificationService.sendToUser(req.user.id, {
        title: 'Uji Coba Notifikasi Quriva 🔔',
        body: `Halo ${req.user.name}, notifikasi berhasil terhubung dengan akun Anda!`,
        data: { type: 'test_notification', timestamp: new Date().toISOString() },
      });
      return successResponse(res, 'Notifikasi uji coba berhasil dikirim.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();

