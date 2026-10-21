const santriService = require('./santri.service');
const hafalanService = require('../hafalan/hafalan.service');
const { successResponse } = require('../../utils/response.util');

class SantriController {
  async getAll(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const paginated = req.query.paginated === 'true' || req.query.paginated === '1';
      const result = await santriService.getSantriByTenant(tenantId, {
        class_id: req.query.class_id || null,
        search: req.query.search || '',
        page: req.query.page,
        per_page: req.query.per_page,
        paginated,
      });

      if (paginated) {
        const { items, total, page, per_page } = result;
        return successResponse(res, 'Daftar santri berhasil diambil.', items, 200, {
          pagination: { page, per_page, total, total_pages: Math.max(1, Math.ceil(total / per_page)) },
        });
      }

      return successResponse(res, 'Daftar santri berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      if (req.user.role === 'wali_santri') {
        await hafalanService.assertSantriAccess(req.user, tenantId, req.params.id);
      }
      const santri = await santriService.getSantriById(req.params.id, tenantId);
      return successResponse(res, 'Detail data santri berhasil diambil.', santri);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const created = await santriService.createSantri(tenantId, req.body);
      return successResponse(res, 'Data santri berhasil ditambahkan.', created, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const updated = await santriService.updateSantri(req.params.id, tenantId, req.body);
      return successResponse(res, 'Data santri berhasil diperbarui.', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      await santriService.deleteSantri(req.params.id, tenantId);
      return successResponse(res, 'Data santri berhasil dihapus.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SantriController();
