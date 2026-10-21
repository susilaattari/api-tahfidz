const db = require('../../config/database');
const tenantsService = require('../tenants/tenants.service');

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

class QuotaRequestsService {
  /**
   * Ringkasan kuota milik tenant + riwayat permintaannya (untuk Admin Tenant).
   */
  async getMine(tenantId) {
    const snap = await tenantsService.getQuotaSnapshot(tenantId);
    const history = await db('quota_requests')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'desc')
      .limit(20);

    return {
      quota: snap.quota,
      used: snap.used,
      member_label: snap.tenant.member_label || 'Santri',
      plan_name: snap.tenant.plan_name || null,
      pending: history.find((r) => r.status === 'pending') || null,
      history,
    };
  }

  /**
   * Admin Tenant mengajukan tambahan kuota.
   */
  async create(tenantId, userId, { add_santri, note } = {}) {
    const add = Math.floor(Number(add_santri));
    if (!Number.isFinite(add) || add < 1) {
      throw httpError('Jumlah tambahan minimal 1.', 400);
    }
    if (add > 10000) {
      throw httpError('Jumlah tambahan terlalu besar. Hubungi tim pusat untuk kebutuhan khusus.', 400);
    }

    const existing = await db('quota_requests').where({ tenant_id: tenantId, status: 'pending' }).first();
    if (existing) {
      throw httpError('Masih ada permintaan tambah kuota yang menunggu persetujuan. Batalkan atau tunggu keputusan tim pusat.', 409);
    }

    const snap = await tenantsService.getQuotaSnapshot(tenantId);
    const estimated = Math.max(0, snap.priceFor(snap.quota + add) - snap.priceFor(snap.quota));

    const [id] = await db('quota_requests').insert({
      tenant_id: tenantId,
      requested_by: userId || null,
      current_quota: snap.quota,
      requested_add: add,
      requested_total: snap.quota + add,
      estimated_price: estimated,
      note: note ? String(note).trim().slice(0, 500) : null,
      status: 'pending',
    });

    return db('quota_requests').where({ id }).first();
  }

  /**
   * Admin Tenant membatalkan permintaan yang masih menunggu.
   */
  async cancel(tenantId, id) {
    const request = await db('quota_requests').where({ id, tenant_id: tenantId }).first();
    if (!request) throw httpError('Permintaan tidak ditemukan.', 404);
    if (request.status !== 'pending') throw httpError('Hanya permintaan yang menunggu yang bisa dibatalkan.', 409);

    await db('quota_requests').where({ id }).update({ status: 'cancelled', updated_at: db.fn.now() });
    return db('quota_requests').where({ id }).first();
  }

  /**
   * Daftar semua permintaan (Super Admin).
   */
  async listAll({ status } = {}) {
    const query = db('quota_requests')
      .leftJoin('tenants', 'quota_requests.tenant_id', 'tenants.id')
      .leftJoin('users', 'quota_requests.requested_by', 'users.id')
      .select(
        'quota_requests.*',
        'tenants.name as tenant_name',
        'tenants.subdomain as tenant_subdomain',
        'tenants.member_label as member_label',
        'tenants.phone as tenant_phone',
        'users.name as requested_by_name'
      )
      .orderBy('quota_requests.created_at', 'desc')
      .limit(200);

    if (status) query.where('quota_requests.status', status);

    const rows = await query;
    return Promise.all(
      rows.map(async (r) => {
        const used = await db('santri').where({ tenant_id: r.tenant_id }).count('id as count').first();
        return { ...r, used: Number(used?.count || 0) };
      })
    );
  }

  /**
   * Setujui: kuota tenant langsung bertambah sesuai jumlah yang diminta.
   */
  async approve(id, reviewerId, { review_note } = {}) {
    const request = await db('quota_requests').where({ id }).first();
    if (!request) throw httpError('Permintaan tidak ditemukan.', 404);
    if (request.status !== 'pending') throw httpError('Permintaan ini sudah diproses.', 409);

    const result = await tenantsService.addSantriQuota(request.tenant_id, {
      add_santri: request.requested_add,
    });

    await db('quota_requests').where({ id }).update({
      status: 'approved',
      reviewed_by: reviewerId || null,
      review_note: review_note ? String(review_note).trim().slice(0, 500) : null,
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    const updated = await db('quota_requests').where({ id }).first();
    return { ...result, request: updated, message: result.message };
  }

  /**
   * Tolak permintaan dengan alasan.
   */
  async reject(id, reviewerId, { reason } = {}) {
    const request = await db('quota_requests').where({ id }).first();
    if (!request) throw httpError('Permintaan tidak ditemukan.', 404);
    if (request.status !== 'pending') throw httpError('Permintaan ini sudah diproses.', 409);

    await db('quota_requests').where({ id }).update({
      status: 'rejected',
      reviewed_by: reviewerId || null,
      review_note: reason ? String(reason).trim().slice(0, 500) : null,
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    return db('quota_requests').where({ id }).first();
  }
}

module.exports = new QuotaRequestsService();
