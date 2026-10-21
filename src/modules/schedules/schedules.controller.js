const schedulesService = require('./schedules.service');
const { successResponse } = require('../../utils/response.util');

class SchedulesController {
  async getAll(req, res, next) {
    try {
      const tenantId =
        req.user.role === 'super_admin'
          ? req.query.tenant_id || req.tenantId
          : req.user.tenant_id;

      const schedules = await schedulesService.getSchedules(req.user, tenantId, req.query);
      return successResponse(res, 'Daftar jadwal halaqah berhasil dimuat.', schedules);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const tenantId =
        req.user.role === 'super_admin'
          ? req.body.tenant_id || req.tenantId
          : req.user.tenant_id;

      const created = await schedulesService.createSchedule(req.user, tenantId, req.body);
      return successResponse(res, 'Jadwal halaqah berhasil ditambahkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const tenantId =
        req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;

      const updated = await schedulesService.updateSchedule(
        req.user,
        req.params.id,
        tenantId,
        req.body
      );
      return successResponse(res, 'Jadwal halaqah berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantId =
        req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;

      await schedulesService.deleteSchedule(req.user, req.params.id, tenantId);
      return successResponse(res, 'Jadwal halaqah berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SchedulesController();
