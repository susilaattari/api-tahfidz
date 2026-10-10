const tenantsService = require('./tenants.service');
const { successResponse } = require('../../utils/response.util');

class TenantsController {
  async getAll(req, res, next) {
    try {
      const tenants = await tenantsService.getAllTenants();
      return successResponse(res, 'Daftar institusi tenant berhasil diambil.', tenants);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenant = await tenantsService.getTenantById(req.params.id);
      return successResponse(res, 'Detail institusi tenant berhasil diambil.', tenant);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const created = await tenantsService.createTenant(req.body);
      return successResponse(res, 'Institusi tenant berhasil didaftarkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await tenantsService.updateTenant(req.params.id, req.body);
      return successResponse(res, 'Data institusi tenant berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await tenantsService.deleteTenant(req.params.id);
      return successResponse(res, 'Institusi tenant berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }

  async updateTheme(req, res, next) {
    try {
      // Allow tenant admin to update their own theme
      const targetTenantId = req.user.role === 'super_admin' ? req.params.id : req.user.tenant_id;
      const updated = await tenantsService.updateTenant(targetTenantId, { theme_config: req.body });
      return successResponse(res, 'Tema institusi berhasil disimpan.', updated);
    } catch (error) {
      next(error);
    }
  }

  async getBySubdomain(req, res, next) {
    try {
      const tenant = await tenantsService.getTenantBySubdomain(req.params.subdomain);
      return successResponse(res, 'Informasi tenant berhasil diambil.', tenant);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TenantsController();
