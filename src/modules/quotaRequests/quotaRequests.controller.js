const quotaRequestsService = require('./quotaRequests.service');
const { successResponse } = require('../../utils/response.util');

class QuotaRequestsController {
  async getMine(req, res, next) {
    try {
      const data = await quotaRequestsService.getMine(req.user.tenant_id);
      return successResponse(res, 'Data kuota dan riwayat permintaan berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await quotaRequestsService.create(req.user.tenant_id, req.user.id, req.body);
      return successResponse(res, 'Permintaan tambah kuota berhasil dikirim ke tim pusat.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const cancelled = await quotaRequestsService.cancel(req.user.tenant_id, req.params.id);
      return successResponse(res, 'Permintaan tambah kuota dibatalkan.', cancelled);
    } catch (error) {
      next(error);
    }
  }

  async listAll(req, res, next) {
    try {
      const data = await quotaRequestsService.listAll({ status: req.query.status });
      return successResponse(res, 'Daftar permintaan tambah kuota berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const result = await quotaRequestsService.approve(req.params.id, req.user.id, req.body);
      return successResponse(res, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const rejected = await quotaRequestsService.reject(req.params.id, req.user.id, req.body);
      return successResponse(res, 'Permintaan tambah kuota ditolak.', rejected);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QuotaRequestsController();
