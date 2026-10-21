const db = require('../../config/database');
const { CONSENT_DOCUMENTS } = require('../../config/consentDocuments');

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const now = () => new Date();

const CONSENT_TYPE_LABELS = {
  privacy_policy: 'Kebijakan Privasi',
  voice_recording: 'Rekaman Suara Anak',
};

const STATUS_LABELS = {
  approved: 'Disetujui',
  revoked: 'Dicabut',
};

class ConsentsService {
  _document(consentType) {
    const document = CONSENT_DOCUMENTS[consentType];
    if (!document) throw httpError('Jenis persetujuan tidak dikenal.', 400);
    return document;
  }

  async _findRecord(executor, userId, consentType, version, santriId = null) {
    const query = executor('user_consents').where({
      user_id: userId,
      consent_type: consentType,
      document_version: version,
      status: 'approved',
    });

    if (santriId) query.where('santri_id', santriId);
    else query.whereNull('santri_id');

    return query.first();
  }

  async _buildRequiredItem(user, consentType, santri = null) {
    const document = this._document(consentType);
    const record = await this._findRecord(
      db,
      user.id,
      consentType,
      document.version,
      santri?.id || null
    );

    return {
      key: consentType === 'voice_recording'
        ? `${consentType}:${santri.id}`
        : consentType,
      consent_type: consentType,
      title: document.title,
      summary: document.summary,
      version: document.version,
      sections: document.sections,
      santri_id: santri?.id || null,
      santri_name: santri?.full_name || null,
      approved: Boolean(record),
      status: record ? 'approved' : 'pending',
      agreed_at: record?.agreed_at || null,
      record_id: record?.id || null,
    };
  }

  async getRequirements(user) {
    const items = [await this._buildRequiredItem(user, 'privacy_policy')];

    if (user.role === 'wali_santri') {
      let query = db('santri').where({ wali_id: user.id });
      if (user.tenant_id) query = query.where('tenant_id', user.tenant_id);
      const santris = await query.orderBy('full_name', 'asc');

      for (const santri of santris) {
        items.push(await this._buildRequiredItem(user, 'voice_recording', santri));
      }
    }

    const approvedCount = items.filter((item) => item.approved).length;

    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id || null,
      },
      all_approved: approvedCount === items.length,
      total: items.length,
      approved_count: approvedCount,
      items,
    };
  }

  async getHistory(userId) {
    return db('user_consents')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  }

  async approve(user, payload = {}, meta = {}) {
    const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
    const items = rawItems.filter((item) => item && item.consent_type);

    if (items.length === 0) {
      throw httpError('Pilih minimal satu persetujuan untuk disimpan.', 400);
    }

    const seen = new Set();
    const normalized = [];

    for (const item of items) {
      const document = this._document(item.consent_type);
      const version = item.document_version || document.version;
      if (version !== document.version) {
        throw httpError(
          `Versi dokumen ${document.title} sudah berubah. Muat ulang halaman lalu setujui versi terbaru.`,
          409
        );
      }

      if (item.consent_type === 'privacy_policy') {
        const key = 'privacy_policy';
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ consent_type: 'privacy_policy', version, santri_id: null });
        continue;
      }

      if (item.consent_type === 'voice_recording') {
        if (user.role !== 'wali_santri') {
          throw httpError('Persetujuan rekaman suara hanya dapat diberikan oleh wali santri.', 403);
        }

        const santriId = Number(item.santri_id);
        if (!Number.isInteger(santriId) || santriId < 1) {
          throw httpError('Data anak wajib dipilih untuk persetujuan rekaman suara.', 400);
        }

        const santri = await db('santri')
          .where({ id: santriId, wali_id: user.id })
          .first();

        if (!santri || (user.tenant_id && Number(santri.tenant_id) !== Number(user.tenant_id))) {
          throw httpError('Anda tidak berhak memberikan persetujuan untuk anak ini.', 403);
        }

        const key = `voice_recording:${santriId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ consent_type: 'voice_recording', version, santri_id: santriId });
      }
    }

    if (normalized.length === 0) {
      throw httpError('Tidak ada persetujuan yang dapat disimpan.', 400);
    }

    const ipAddress = meta.ip_address ? String(meta.ip_address).slice(0, 72) : null;
    const userAgent = meta.user_agent ? String(meta.user_agent).slice(0, 2000) : null;

    await db.transaction(async (trx) => {
      for (const item of normalized) {
        const existing = await this._findRecord(
          trx,
          user.id,
          item.consent_type,
          item.version,
          item.santri_id
        );

        const payload = {
          tenant_id: user.tenant_id || null,
          status: 'approved',
          agreed_at: now(),
          revoked_at: null,
          ip_address: ipAddress,
          user_agent: userAgent,
          updated_at: trx.fn.now(),
        };

        if (existing) {
          await trx('user_consents').where({ id: existing.id }).update(payload);
        } else {
          await trx('user_consents').insert({
            ...payload,
            user_id: user.id,
            santri_id: item.santri_id,
            consent_type: item.consent_type,
            document_version: item.version,
          });
        }
      }
    });

    return this.getRequirements(user);
  }

  async revoke(user, id) {
    const record = await db('user_consents')
      .where({ id, user_id: user.id })
      .first();

    if (!record) throw httpError('Persetujuan tidak ditemukan.', 404);

    if (record.status === 'approved') {
      await db('user_consents').where({ id }).update({
        status: 'revoked',
        revoked_at: now(),
        updated_at: db.fn.now(),
      });
    }

    return db('user_consents').where({ id }).first();
  }

  _applyScope(query, user, filters = {}) {
    if (user.role !== 'super_admin') {
      query.where('user_consents.tenant_id', user.tenant_id);
    } else if (filters.tenant_id) {
      query.where('user_consents.tenant_id', Number(filters.tenant_id));
    }
    return query;
  }

  _baseQuery(user, filters = {}) {
    const query = db('user_consents')
      .leftJoin('users', 'user_consents.user_id', 'users.id')
      .leftJoin('santri', 'user_consents.santri_id', 'santri.id')
      .leftJoin('tenants', 'user_consents.tenant_id', 'tenants.id')
      .select(
        'user_consents.*',
        'users.name as user_name',
        'users.email as user_email',
        'users.role as user_role',
        'santri.full_name as santri_name',
        'tenants.name as tenant_name',
        'tenants.subdomain as tenant_subdomain'
      );

    this._applyScope(query, user, filters);

    const status = filters.status || 'approved';
    if (status !== 'all') query.where('user_consents.status', status);
    if (filters.consent_type) query.where('user_consents.consent_type', filters.consent_type);
    if (filters.role) query.where('users.role', filters.role);

    const search = String(filters.search || '').trim().toLowerCase();
    if (search) {
      query.where((builder) => {
        builder
          .whereRaw('LOWER(users.name) LIKE ?', [`%${search}%`])
          .orWhereRaw('LOWER(users.email) LIKE ?', [`%${search}%`])
          .orWhereRaw('LOWER(COALESCE(santri.full_name, \'\')) LIKE ?', [`%${search}%`])
          .orWhereRaw('LOWER(COALESCE(tenants.name, \'\')) LIKE ?', [`%${search}%`]);
      });
    }

    return query;
  }

  async _summary(user, filters = {}) {
    const countRows = async (builder) => {
      const row = await builder.count({ count: 'user_consents.id' }).first();
      return Number(row?.count || 0);
    };

    const scoped = (status) => {
      const q = db('user_consents');
      this._applyScope(q, user, filters);
      if (status) q.where('user_consents.status', status);
      return q;
    };

    const [totalApproved, privacyApproved, voiceApproved, revoked, approvedUsers] =
      await Promise.all([
        countRows(scoped('approved')),
        countRows(scoped('approved').where('user_consents.consent_type', 'privacy_policy')),
        countRows(scoped('approved').where('user_consents.consent_type', 'voice_recording')),
        countRows(scoped('revoked')),
        scoped('approved').countDistinct({ count: 'user_consents.user_id' }).first(),
      ]);

    const usersQuery = db('users');
    if (user.role !== 'super_admin') {
      usersQuery.where('tenant_id', user.tenant_id);
    } else if (filters.tenant_id) {
      usersQuery.where('tenant_id', Number(filters.tenant_id));
    }
    const totalUsersRow = await usersQuery.count({ count: 'id' }).first();
    const totalUsers = Number(totalUsersRow?.count || 0);
    const approvedUserCount = Number(approvedUsers?.count || 0);

    return {
      total_approved: totalApproved,
      privacy_approved: privacyApproved,
      voice_approved: voiceApproved,
      revoked,
      total_users: totalUsers,
      approved_users: approvedUserCount,
      coverage_percent: totalUsers
        ? Math.min(100, Math.round((approvedUserCount / totalUsers) * 100))
        : 0,
    };
  }

  async listAdmin(user, filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(filters.per_page) || 10));

    const base = this._baseQuery(user, filters);
    const totalRow = await base
      .clone()
      .clearSelect()
      .clearOrder()
      .count({ count: 'user_consents.id' })
      .first();
    const total = Number(totalRow?.count || 0);

    const items = await base
      .orderBy('user_consents.agreed_at', 'desc')
      .orderBy('user_consents.id', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage);

    const counts = await this._summary(user, filters);

    return {
      items,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
      counts,
    };
  }

  async summary(user, filters = {}) {
    return this._summary(user, filters);
  }

  async getAdminById(user, id) {
    const row = await this._baseQuery(user, { status: 'all' })
      .where('user_consents.id', Number(id))
      .first();
    if (!row) throw httpError('Data persetujuan tidak ditemukan.', 404);
    return row;
  }

  async exportCsv(user, filters = {}) {
    const base = this._baseQuery(user, { ...filters, status: filters.status || 'all' });
    const rows = await base
      .orderBy('user_consents.agreed_at', 'desc')
      .limit(5000);

    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Nama Pengguna',
      'Email',
      'Role',
      'Tenant',
      'Subdomain',
      'Nama Anak',
      'Jenis Persetujuan',
      'Versi Dokumen',
      'Status',
      'Tanggal Setuju',
      'Tanggal Dicabut',
    ];
    const lines = [
      headers.map(escape).join(','),
      ...rows.map((row) =>
        [
          row.user_name,
          row.user_email,
          row.user_role,
          row.tenant_name,
          row.tenant_subdomain,
          row.santri_name,
          CONSENT_TYPE_LABELS[row.consent_type] || row.consent_type,
          row.document_version,
          STATUS_LABELS[row.status] || row.status,
          row.agreed_at ? new Date(row.agreed_at).toISOString() : '',
          row.revoked_at ? new Date(row.revoked_at).toISOString() : '',
        ]
          .map(escape)
          .join(',')
      ),
    ];

    return `\ufeff${lines.join('\n')}`;
  }
}

module.exports = new ConsentsService();
