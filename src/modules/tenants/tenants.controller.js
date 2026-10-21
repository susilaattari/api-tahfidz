const tenantsService = require('./tenants.service');
const { successResponse } = require('../../utils/response.util');

class TenantsController {
  async getAll(req, res, next) {
    try {
      const paginated = req.query.paginated === 'true' || req.query.paginated === '1';
      const result = await tenantsService.getAllTenants({
        search: req.query.search || '',
        status: req.query.status || '',
        page: req.query.page,
        per_page: req.query.per_page,
        paginated,
      });

      if (paginated) {
        const { items, total, page, per_page, counts } = result;
        return successResponse(res, 'Daftar institusi tenant berhasil diambil.', items, 200, {
          pagination: { page, per_page, total, total_pages: Math.max(1, Math.ceil(total / per_page)) },
          counts,
        });
      }

      return successResponse(res, 'Daftar institusi tenant berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }

  async getPlatformSummary(req, res, next) {
    try {
      const summary = await tenantsService.getPlatformSummary();
      return successResponse(res, 'Ringkasan ekosistem platform SaaS berhasil diambil.', summary);
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

  async updateSettings(req, res, next) {
    try {
      const targetTenantId = req.user.role === 'super_admin' ? req.params.id : req.user.tenant_id;
      const { institution_type, has_wali, member_label, name, address, phone } = req.body;
      const updated = await tenantsService.updateTenant(targetTenantId, {
        institution_type,
        has_wali,
        member_label,
        name,
        address,
        phone,
      });
      return successResponse(res, 'Pengaturan model institusi berhasil diperbarui.', updated);
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

  async registerSelf(req, res, next) {
    try {
      const registered = await tenantsService.registerSelfTenant(req.body);
      return successResponse(res, registered.message, registered, 201);
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const approved = await tenantsService.approveTenant(req.params.id, req.body);
      return successResponse(res, 'Pendaftaran tenant berhasil disetujui dan diaktifkan.', approved);
    } catch (error) {
      next(error);
    }
  }

  async addQuota(req, res, next) {
    try {
      const result = await tenantsService.addSantriQuota(req.params.id, req.body);
      return successResponse(res, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const rejected = await tenantsService.rejectTenant(req.params.id, req.body);
      return successResponse(res, rejected.message, rejected);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TenantsController();
