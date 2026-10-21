const consentsService = require('./consents.service');
const { successResponse } = require('../../utils/response.util');

const requestMeta = (req) => ({
  ip_address:
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null,
  user_agent: req.headers['user-agent'] || null,
});

class ConsentsController {
  async requirements(req, res, next) {
    try {
      const data = await consentsService.getRequirements(req.user);
      return successResponse(res, 'Persetujuan pengguna berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async history(req, res, next) {
    try {
      const data = await consentsService.getHistory(req.user.id);
      return successResponse(res, 'Riwayat persetujuan berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const data = await consentsService.approve(req.user, req.body, requestMeta(req));
      return successResponse(res, 'Persetujuan berhasil disimpan.', data);
    } catch (error) {
      next(error);
    }
  }

  async revoke(req, res, next) {
    try {
      const data = await consentsService.revoke(req.user, req.params.id);
      return successResponse(res, 'Persetujuan berhasil dicabut.', data);
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req, res, next) {
    try {
      const result = await consentsService.listAdmin(req.user, req.query);
      return successResponse(
        res,
        'Daftar persetujuan berhasil diambil.',
        result.items,
        200,
        { pagination: result.pagination, counts: result.counts }
      );
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const data = await consentsService.summary(req.user, req.query);
      return successResponse(res, 'Ringkasan persetujuan berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async detail(req, res, next) {
    try {
      const data = await consentsService.getAdminById(req.user, req.params.id);
      return successResponse(res, 'Detail persetujuan berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req, res, next) {
    try {
      const csv = await consentsService.exportCsv(req.user, req.query);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="persetujuan-pengguna-${date}.csv"`
      );
      return res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConsentsController();
