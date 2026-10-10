const hafalanService = require('./hafalan.service');
const { successResponse } = require('../../utils/response.util');

class HafalanController {
  async getHistories(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const histories = await hafalanService.getHistories(tenantId, req.query);
      return successResponse(res, 'Riwayat hafalan berhasil diambil.', histories);
    } catch (error) {
      next(error);
    }
  }

  async record(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const recorded = await hafalanService.recordHafalan(tenantId, req.user.id, req.body);
      return successResponse(res, 'Setoran hafalan berhasil dicatat.', recorded, 201);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const summary = await hafalanService.getSantriHafalanSummary(tenantId, req.params.santri_id);
      return successResponse(res, 'Ringkasan progres hafalan santri berhasil diambil.', summary);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HafalanController();
