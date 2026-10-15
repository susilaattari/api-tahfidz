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

    // Attach santri, user counts, and admin contact details
    const tenantsWithCounts = await Promise.all(
      tenants.map(async (t) => {
        const santriCount = await db('santri').where({ tenant_id: t.id }).count('id as count').first();
        const guruCount = await db('users').where({ tenant_id: t.id, role: 'guru' }).count('id as count').first();
        const adminUser = await db('users').where({ tenant_id: t.id, role: 'admin_tenant' }).first();
        const subMeta = getSubscriptionMeta(t);

        return {
          ...t,
          admin_name: adminUser?.name || null,
          admin_email: t.email || adminUser?.email || null,
          admin_phone: t.phone || adminUser?.phone || null,
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
    const adminUser = await db('users').where({ tenant_id: id, role: 'admin_tenant' }).first();
    const subMeta = getSubscriptionMeta(tenant);

    return {
      ...tenant,
      admin_name: adminUser?.name || null,
      admin_email: tenant.email || adminUser?.email || null,
      admin_phone: tenant.phone || adminUser?.phone || null,
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
    const { name, subdomain, plan_id, admin_name, admin_email, admin_password, theme_config, subscription_expires_at, phone, address } = data;

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
      phone: phone || null,
      email: admin_email || null,
      address: address || null,
      payment_method: 'manual_transfer',
      payment_status: 'paid',
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
        phone: phone || null,
        password_hash: passwordHash,
        role: 'admin_tenant',
        status: 'active',
      });
    }

    return this.getTenantById(tenantId);
  }

  /**
   * Self-Service Tenant Registration (Public User)
   * Creates tenant with 'pending_approval' status awaiting manual WhatsApp transfer confirmation.
   */
  async registerSelfTenant(data) {
    const {
      name,
      subdomain,
      plan_id,
      admin_name,
      admin_email,
      admin_phone: rawAdminPhone,
      phone: rawPhone,
      admin_password,
      address,
      payment_proof_note,
      payment_method,
    } = data;

    const admin_phone = (rawAdminPhone || rawPhone || data.whatsapp || '').toString().trim();

    if (!name || !String(name).trim()) {
      const err = new Error('Nama institusi/pesantren wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!subdomain || !String(subdomain).trim()) {
      const err = new Error('Subdomain wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const cleanSubdomain = String(subdomain).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!cleanSubdomain || cleanSubdomain.length < 3) {
      const err = new Error('Subdomain minimal 3 karakter (huruf, angka, atau strip).');
      err.statusCode = 400;
      throw err;
    }

    if (!admin_name || !String(admin_name).trim()) {
      const err = new Error('Nama penanggung jawab / admin wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!admin_email || !String(admin_email).trim()) {
      const err = new Error('Email admin wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!admin_phone || !String(admin_phone).trim()) {
      const err = new Error('Nomor WhatsApp aktif wajib diisi untuk verifikasi pembayaran.');
      err.statusCode = 400;
      throw err;
    }

    if (!admin_password || String(admin_password).length < 6) {
      const err = new Error('Kata sandi admin minimal 6 karakter.');
      err.statusCode = 400;
      throw err;
    }

    // Check unique subdomain
    const existingSubdomain = await db('tenants').where({ subdomain: cleanSubdomain }).first();
    if (existingSubdomain) {
      const err = new Error(`Subdomain '${cleanSubdomain}' sudah digunakan. Silakan gunakan subdomain yang lain.`);
      err.statusCode = 409;
      throw err;
    }

    // Check unique user email
    const existingUser = await db('users').where({ email: admin_email.toLowerCase().trim() }).first();
    if (existingUser) {
      const err = new Error(`Email '${admin_email}' sudah terdaftar. Silakan gunakan email lain atau login jika sudah memiliki akun.`);
      err.statusCode = 409;
      throw err;
    }

    // Get chosen package
    const pkg = await db('packages').where({ id: plan_id || 1 }).first();
    const effectivePlanId = pkg ? pkg.id : 1;

    const defaultTheme = {
      primaryColor: '#059669',
      institutionName: name,
    };

    const [tenantId] = await db('tenants').insert({
      name: String(name).trim(),
      subdomain: cleanSubdomain,
      plan_id: effectivePlanId,
      status: 'pending_approval',
      phone: String(admin_phone).trim(),
      email: admin_email.toLowerCase().trim(),
      address: address ? String(address).trim() : null,
      payment_method: payment_method || 'manual_transfer',
      payment_status: 'pending',
      payment_proof_note: payment_proof_note ? String(payment_proof_note).trim() : null,
      subscription_expires_at: null,
      theme_config: JSON.stringify(defaultTheme),
    });

    // Create Admin User with status 'pending_approval'
    const passwordHash = await bcrypt.hash(admin_password, 10);
    await db('users').insert({
      tenant_id: tenantId,
      name: String(admin_name).trim(),
      email: admin_email.toLowerCase().trim(),
      phone: String(admin_phone).trim(),
      password_hash: passwordHash,
      role: 'admin_tenant',
      status: 'pending_approval',
    });

    const superAdminWa = process.env.SUPERADMIN_WA || '6281234567890';
    const pkgPrice = pkg ? Number(pkg.price) : 299000;
    const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(pkgPrice);

    const waTemplate = encodeURIComponent(
      `Halo Super Admin SaaS Tahfidz,\n\nSaya ingin konfirmasi pendaftaran lembaga baru:\n• Lembaga: ${name}\n• Subdomain: ${cleanSubdomain}.tahfidzapp.com\n• Paket: ${pkg ? pkg.name : 'Paket Basic'} (${formattedPrice})\n• PIC / Admin: ${admin_name} (${admin_phone})\n• Email: ${admin_email}\n\nSaya sudah melakukan transfer pembayaran manual. Berikut saya lampirkan bukti transfernya. Mohon bantuannya untuk aktivasi akun lembaga kami. Terima kasih!`
    );

    const waLink = `https://wa.me/${superAdminWa.replace(/[^0-9]/g, '')}?text=${waTemplate}`;

    return {
      tenant_id: tenantId,
      name,
      subdomain: cleanSubdomain,
      status: 'pending_approval',
      package: pkg
        ? {
            id: pkg.id,
            name: pkg.name,
            code: pkg.code,
            price: pkg.price,
            max_santri: pkg.max_santri,
          }
        : null,
      payment: {
        method: payment_method || 'manual_transfer',
        amount: pkgPrice,
        amount_formatted: formattedPrice,
        bank_accounts: [
          {
            bank: 'Bank Syariah Indonesia (BSI)',
            account_number: '7141-2345-67',
            account_name: 'PT SaaS Tahfidz Quran Digital',
          },
          {
            bank: 'Bank Central Asia (BCA)',
            account_number: '8290-123-456',
            account_name: 'PT SaaS Tahfidz Quran Digital',
          },
        ],
        whatsapp_confirmation_url: waLink,
        whatsapp_number: superAdminWa,
      },
      message: 'Pendaftaran lembaga berhasil dikirim. Silakan selesaikan pembayaran dan kirim bukti transfer ke WhatsApp Super Admin untuk aktivasi.',
    };
  }

  /**
   * Super Admin approves a pending tenant
   */
  async approveTenant(id, { extend_months = 1, notes } = {}) {
    const tenant = await db('tenants').where({ id }).first();
    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const months = Number(extend_months) > 0 ? Number(extend_months) : 1;
    const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    await db('tenants').where({ id }).update({
      status: 'active',
      payment_status: 'paid',
      subscription_expires_at: expiresAt,
      rejection_reason: null,
      updated_at: db.fn.now(),
    });

    // Activate the Tenant Admin user
    await db('users')
      .where({ tenant_id: id, role: 'admin_tenant' })
      .update({
        status: 'active',
        updated_at: db.fn.now(),
      });

    return this.getTenantById(id);
  }

  /**
   * Super Admin rejects a pending tenant
   */
  async rejectTenant(id, { reason } = {}) {
    const tenant = await db('tenants').where({ id }).first();
    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const rejectionReason = reason || 'Bukti transfer tidak valid atau belum diterima.';

    await db('tenants').where({ id }).update({
      status: 'rejected',
      payment_status: 'rejected',
      rejection_reason: rejectionReason,
      updated_at: db.fn.now(),
    });

    await db('users')
      .where({ tenant_id: id, role: 'admin_tenant' })
      .update({
        status: 'rejected',
        updated_at: db.fn.now(),
      });

    return {
      id,
      status: 'rejected',
      rejection_reason: rejectionReason,
      message: 'Pendaftaran tenant telah ditolak.',
    };
  }

  async updateTenant(id, data) {
    const { name, plan_id, status, theme_config, subscription_expires_at, extend_months, phone, address, payment_status, payment_proof_note } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (plan_id !== undefined) updatePayload.plan_id = plan_id;
    if (status) updatePayload.status = status;
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;
    if (payment_status !== undefined) updatePayload.payment_status = payment_status;
    if (payment_proof_note !== undefined) updatePayload.payment_proof_note = payment_proof_note;
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
