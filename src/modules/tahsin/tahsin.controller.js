const tahsinService = require('./tahsin.service');
const { successResponse } = require('../../utils/response.util');

class TahsinController {
  async getAll(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const filters = { ...req.query };
      if (['wali', 'wali_santri'].includes(req.user.role) && !filters.santri_id && !filters.wali_id) {
        filters.wali_id = req.user.id;
      }
      const list = await tahsinService.getSubmissions(tenantId, filters);
      return successResponse(res, 'Daftar setoran tahsin berhasil diambil.', list);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const item = await tahsinService.getSubmissionById(req.params.id, tenantId);
      return successResponse(res, 'Detail setoran tahsin berhasil diambil.', item);
    } catch (error) {
      next(error);
    }
  }

  async submit(req, res, next) {
    try {
      const tenantId = req.user.tenant_id || req.tenantId;
      const created = await tahsinService.createSubmission(tenantId, req.user.id, req.body, req.file);
      return successResponse(res, 'Setoran audio tahsin berhasil dikirim ke dewan guru.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async review(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const reviewed = await tahsinService.reviewSubmission(
        req.params.id,
        tenantId,
        req.user.id,
        req.body,
        req.file
      );
      return successResponse(res, 'Evaluasi tahsin berhasil disimpan.', reviewed);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const mode = req.query.mode || 'audio'; // default 'audio' agar catatan evaluasi untuk santri tidak hilang!
      const result = await tahsinService.deleteSubmission(req.params.id, tenantId, mode);
      return successResponse(res, 'File rekaman audio berhasil dibersihkan dari server.', result);
    } catch (error) {
      next(error);
    }
  }

  async cleanAudio(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const result = await tahsinService.cleanAudioFile(req.params.id, tenantId);
      return successResponse(res, 'File audio berhasil dihapus. Catatan koreksi tetap tersimpan untuk santri.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TahsinController();
