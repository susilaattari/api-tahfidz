const hafalanService = require('./hafalan.service');
const { successResponse } = require('../../utils/response.util');

const resolveTenant = (req) =>
  req.user.role === 'super_admin' ? (req.query.tenant_id || req.body?.tenant_id || req.tenantId) : req.user.tenant_id;

class HafalanController {
  async getHistories(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const paginated = req.query.paginated === 'true' || req.query.paginated === '1';
      const result = await hafalanService.getHistories(tenantId, req.query, req.user);

      if (paginated) {
        const { items, total, page, per_page } = result;
        return successResponse(res, 'Riwayat hafalan berhasil diambil.', items, 200, {
          pagination: { page, per_page, total, total_pages: Math.max(1, Math.ceil(total / per_page)) },
        });
      }

      return successResponse(res, 'Riwayat hafalan berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }

  async record(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const recorded = await hafalanService.recordHafalan(tenantId, req.user.id, req.body);
      if (recorded && recorded.deduplicated) {
        // Permintaan ulang dari antrean offline: setoran sudah tersimpan sebelumnya
        return successResponse(res, 'Setoran hafalan sudah tercatat sebelumnya.', recorded, 200);
      }
      return successResponse(res, 'Setoran hafalan berhasil dicatat.', recorded, 201);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      await hafalanService.assertSantriAccess(req.user, tenantId, req.params.santri_id);
      const summary = await hafalanService.getSantriHafalanSummary(tenantId, req.params.santri_id);
      return successResponse(res, 'Ringkasan progres hafalan santri berhasil diambil.', summary);
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req, res, next) {
    try {
      const detail = await hafalanService.getDetail(resolveTenant(req), req.user, Number(req.params.id));
      return successResponse(res, 'Detail setoran hafalan berhasil diambil.', detail);
    } catch (error) {
      next(error);
    }
  }

  async correct(req, res, next) {
    try {
      const updated = await hafalanService.koreksiSetoran(resolveTenant(req), req.user, Number(req.params.id), req.body);
      return successResponse(res, 'Koreksi setoran berhasil disimpan.', updated);
    } catch (error) {
      next(error);
    }
  }

  async getPosisi(req, res, next) {
    try {
      const santriId = req.params.santri_id || req.params.id;
      const posisi = await hafalanService.getPosisi(resolveTenant(req), req.user, santriId, req.query.jenis);
      return successResponse(res, 'Posisi hafalan berikutnya berhasil diambil.', posisi);
    } catch (error) {
      next(error);
    }
  }

  async getDaftarUlang(req, res, next) {
    try {
      const data = await hafalanService.getDaftarUlang(resolveTenant(req), req.user, req.params.santri_id);
      return successResponse(res, 'Daftar ayat yang perlu diulang berhasil diambil.', data);
    } catch (error) {
      next(error);
    }
  }

  async getSantriSetoran(req, res, next) {
    try {
      const tenantId = resolveTenant(req);
      const paginated = req.query.paginated === 'true' || req.query.paginated === '1';
      await hafalanService.assertSantriAccess(req.user, tenantId, req.params.id);
      const result = await hafalanService.getHistories(tenantId, { ...req.query, santri_id: req.params.id }, req.user);

      if (paginated) {
        const { items, total, page, per_page } = result;
        return successResponse(res, 'Riwayat setoran santri berhasil diambil.', items, 200, {
          pagination: { page, per_page, total, total_pages: Math.max(1, Math.ceil(total / per_page)) },
        });
      }

      return successResponse(res, 'Riwayat setoran santri berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HafalanController();
