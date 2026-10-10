const certificatesService = require('./certificates.service');
const { successResponse } = require('../../utils/response.util');

class CertificatesController {
  async getSantriCertificates(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const list = await certificatesService.getCertificatesBySantri(tenantId, req.params.santri_id);
      return successResponse(res, 'Daftar e-sertifikat berhasil diambil.', list);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const cert = await certificatesService.getCertificateById(req.params.id, tenantId);
      return successResponse(res, 'Detail e-sertifikat berhasil diambil.', cert);
    } catch (error) {
      next(error);
    }
  }

  async issue(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const { santri_id, juz_completed } = req.body;
      const cert = await certificatesService.issueCertificate(tenantId, santri_id, juz_completed);
      return successResponse(res, 'E-Sertifikat berhasil diterbitkan secara otomatis.', cert, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CertificatesController();
