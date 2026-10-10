const classesService = require('./classes.service');
const { successResponse } = require('../../utils/response.util');

class ClassesController {
  async getAll(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const classes = await classesService.getClassesByTenant(tenantId);
      return successResponse(res, 'Daftar kelas berhasil diambil.', classes);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const classData = await classesService.getClassById(req.params.id, tenantId);
      return successResponse(res, 'Detail kelas berhasil diambil.', classData);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const created = await classesService.createClass(tenantId, req.body);
      return successResponse(res, 'Kelas berhasil dibuat.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const updated = await classesService.updateClass(req.params.id, tenantId, req.body);
      return successResponse(res, 'Data kelas berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      await classesService.deleteClass(req.params.id, tenantId);
      return successResponse(res, 'Kelas berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClassesController();
