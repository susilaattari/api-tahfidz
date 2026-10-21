const dashboardContentService = require('./dashboardContent.service');
const { successResponse } = require('../../utils/response.util');

class DashboardContentController {
  /**
   * Public endpoint to get personalized portal/root dashboard content
   * GET /api/dashboard-content/public/:subdomain?
   */
  async getPublic(req, res, next) {
    try {
      const subdomain = req.params.subdomain || req.query.subdomain;
      const data = await dashboardContentService.getPublicContent(subdomain);
      return successResponse(res, 'Konten portal dashboard berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Superadmin endpoint to get all content settings & overrides
   * GET /api/dashboard-content
   */
  async getAdmin(req, res, next) {
    try {
      const data = await dashboardContentService.getAdminContent();
      return successResponse(res, 'Pengaturan konten portal berhasil dimuat.', data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Superadmin endpoint to update global default content
   * PUT /api/dashboard-content
   */
  async updateGlobal(req, res, next) {
    try {
      const updated = await dashboardContentService.updateGlobalContent(req.body);
      return successResponse(res, 'Konten global portal berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Superadmin endpoint to set tenant-specific override
   * POST /api/dashboard-content/tenant/:tenantId
   */
  async upsertTenantOverride(req, res, next) {
    try {
      const updated = await dashboardContentService.upsertTenantOverride(Number(req.params.tenantId), req.body);
      return successResponse(res, 'Konten khusus tenant berhasil disimpan.', updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Superadmin endpoint to delete tenant override
   * DELETE /api/dashboard-content/tenant/:tenantId
   */
  async deleteTenantOverride(req, res, next) {
    try {
      await dashboardContentService.deleteTenantOverride(Number(req.params.tenantId));
      return successResponse(res, 'Kustomisasi tenant berhasil dihapus. Tenant kembali menggunakan konten global.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardContentController();
