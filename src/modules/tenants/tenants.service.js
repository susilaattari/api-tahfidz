const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { getSubscriptionMeta } = require('../../jobs/subscriptionChecker.job');

class TenantsService {
  async getAllTenants() {
    const tenants = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.code as plan_code',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.features as plan_features'
      )
      .orderBy('tenants.created_at', 'desc');

    // Attach santri and user counts
    const tenantsWithCounts = await Promise.all(
      tenants.map(async (t) => {
        const santriCount = await db('santri').where({ tenant_id: t.id }).count('id as count').first();
        const guruCount = await db('users').where({ tenant_id: t.id, role: 'guru' }).count('id as count').first();
        const subMeta = getSubscriptionMeta(t);

        return {
          ...t,
          ...subMeta,
          theme_config: typeof t.theme_config === 'string' ? JSON.parse(t.theme_config || '{}') : t.theme_config,
          plan_features: typeof t.plan_features === 'string' ? JSON.parse(t.plan_features || '{}') : (t.plan_features || {}),
          stats: {
            total_santri: Number(santriCount?.count || 0),
            total_guru: Number(guruCount?.count || 0),
          },
        };
      })
    );

    return tenantsWithCounts;
  }

  async getTenantById(id) {
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.id', id)
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.code as plan_code',
        'packages.price as plan_price',
        'packages.features as plan_features'
      )
      .first();

    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const santriCount = await db('santri').where({ tenant_id: id }).count('id as count').first();
    const guruCount = await db('users').where({ tenant_id: id, role: 'guru' }).count('id as count').first();
    const subMeta = getSubscriptionMeta(tenant);

    return {
      ...tenant,
      ...subMeta,
      theme_config: typeof tenant.theme_config === 'string' ? JSON.parse(tenant.theme_config || '{}') : tenant.theme_config,
      plan_features: typeof tenant.plan_features === 'string' ? JSON.parse(tenant.plan_features || '{}') : tenant.plan_features,
      stats: {
        total_santri: Number(santriCount?.count || 0),
        total_guru: Number(guruCount?.count || 0),
      },
    };
  }

  async createTenant(data) {
    const { name, subdomain, plan_id, admin_name, admin_email, admin_password, theme_config, subscription_expires_at } = data;

    if (!name || !subdomain) {
      const err = new Error('Nama institusi dan subdomain wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    // Check unique subdomain
    const existing = await db('tenants').where({ subdomain }).first();
    if (existing) {
      const err = new Error(`Subdomain '${subdomain}' sudah digunakan.`);
      err.statusCode = 409;
      throw err;
    }

    const defaultTheme = {
      primaryColor: '#059669',
      institutionName: name,
    };

    const now = new Date();
    const defaultExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const expiresAt = subscription_expires_at || defaultExpires;

    const [tenantId] = await db('tenants').insert({
      name,
      subdomain,
      plan_id: plan_id || 1,
      status: 'active',
      subscription_expires_at: expiresAt,
      theme_config: JSON.stringify(theme_config || defaultTheme),
    });

    // If initial admin credentials are provided, create the Tenant Admin
    if (admin_email && admin_password) {
      const passwordHash = await bcrypt.hash(admin_password, 10);
      await db('users').insert({
        tenant_id: tenantId,
        name: admin_name || `Admin ${name}`,
        email: admin_email,
        password_hash: passwordHash,
        role: 'admin_tenant',
        status: 'active',
      });
    }

    return this.getTenantById(tenantId);
  }

  async updateTenant(id, data) {
    const { name, plan_id, status, theme_config, subscription_expires_at, extend_months } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (plan_id !== undefined) updatePayload.plan_id = plan_id;
    if (status) updatePayload.status = status;
    if (subscription_expires_at !== undefined) {
      updatePayload.subscription_expires_at = subscription_expires_at;
    }

    // Support quick subscription extension (+1, +3, +12 months)
    if (extend_months && Number(extend_months) > 0) {
      const currentTenant = await db('tenants').where({ id }).first();
      const now = new Date();
      let baseDate = currentTenant?.subscription_expires_at ? new Date(currentTenant.subscription_expires_at) : now;
      if (baseDate < now) {
        baseDate = now;
      }
      baseDate.setMonth(baseDate.getMonth() + Number(extend_months));
      updatePayload.subscription_expires_at = baseDate.toISOString().slice(0, 19).replace('T', ' ');

      // If tenant was suspended due to expiration, auto reactivate upon payment/extension
      if (currentTenant && currentTenant.status === 'suspended') {
        updatePayload.status = 'active';
      }
    }

    if (theme_config) {
      updatePayload.theme_config = typeof theme_config === 'object' ? JSON.stringify(theme_config) : theme_config;
    }
    updatePayload.updated_at = db.fn.now();

    await db('tenants').where({ id }).update(updatePayload);
    return this.getTenantById(id);
  }

  async deleteTenant(id) {
    await db('tenants').where({ id }).del();
    return true;
  }

  async getTenantBySubdomain(subdomain) {
    const tenant = await db('tenants')
      .where({ subdomain })
      .select('id', 'name', 'subdomain', 'status', 'theme_config')
      .first();

    if (!tenant) {
      const err = new Error('Institusi dengan subdomain tersebut tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    return {
      ...tenant,
      theme_config: typeof tenant.theme_config === 'string' ? JSON.parse(tenant.theme_config || '{}') : tenant.theme_config,
    };
  }
}

module.exports = new TenantsService();
