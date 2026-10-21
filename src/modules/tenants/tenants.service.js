const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const brand = require('../../config/brand');
const { getSubscriptionMeta } = require('../../jobs/subscriptionChecker.job');
const authService = require('../auth/auth.service');

/**
 * Kuota santri/peserta efektif sebuah tenant:
 * nilai terbesar antara kuota tambahan yang dibeli (requested_santri_count)
 * dan kapasitas dasar paket (max_santri). Aturan ini sama dengan yang dipakai
 * santri.service saat memvalidasi penambahan santri baru.
 */
function resolveSantriQuota(tenant) {
  return Math.max(
    Number(tenant?.requested_santri_count || 0),
    Number(tenant?.plan_max_santri || 10)
  );
}

/**
 * Tagihan per periode langganan untuk kuota tertentu, berdasarkan paket tenant.
 * Paket per-santri: kuota x harga. Paket lain: harga dasar + (kelebihan kuota x harga tambahan).
 */
function computePeriodPrice(tenant, quota) {
  const features = typeof tenant.plan_features === 'string'
    ? JSON.parse(tenant.plan_features || '{}')
    : (tenant.plan_features || {});
  const basePrice = Number(tenant.plan_price || 0);
  const baseCapacity = Number(tenant.plan_max_santri || 10);
  const extraPrice = Number(tenant.plan_extra_price_per_user || 0);
  return features.pricing_type === 'per_user'
    ? quota * basePrice
    : basePrice + Math.max(0, quota - baseCapacity) * extraPrice;
}

class TenantsService {
  async getAllTenants(options = {}) {
    const {
      search = '',
      status = '',
      page = 1,
      per_page: perPage = 10,
      paginated = false,
    } = options;

    let query = db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.code as plan_code',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
        'packages.features as plan_features'
      );

    const cleanSearch = String(search || '').trim().toLowerCase();
    if (cleanSearch) {
      query = query.where((builder) => {
        builder
          .whereRaw('LOWER(tenants.name) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(tenants.subdomain) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(COALESCE(tenants.email, \'\')) LIKE ?', [`%${cleanSearch}%`])
          .orWhereRaw('LOWER(COALESCE(tenants.phone, \'\')) LIKE ?', [`%${cleanSearch}%`]);
      });
    }

    if (status) {
      if (status === 'suspended') {
        query = query.whereIn('tenants.status', ['suspended', 'rejected']);
      } else {
        query = query.where('tenants.status', status);
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(perPage) || 10));
    let total = null;
    let counts = null;

    if (paginated) {
      const totalRow = await query.clone().clearSelect().clearOrder().count({ count: 'tenants.id' }).first();
      total = Number(totalRow?.count || 0);
      query = query.limit(pageSize).offset((pageNum - 1) * pageSize);

      const [allRow, activeRow, pendingRow, suspendedRow] = await Promise.all([
        db('tenants').count({ count: 'id' }).first(),
        db('tenants').where('status', 'active').count({ count: 'id' }).first(),
        db('tenants').where('status', 'pending_approval').count({ count: 'id' }).first(),
        db('tenants').whereIn('status', ['suspended', 'rejected']).count({ count: 'id' }).first(),
      ]);
      counts = {
        total: Number(allRow?.count || 0),
        active: Number(activeRow?.count || 0),
        pending: Number(pendingRow?.count || 0),
        suspended: Number(suspendedRow?.count || 0),
      };
    }

    const tenants = await query.orderBy('tenants.created_at', 'desc');

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
          santri_quota: resolveSantriQuota(t),
          theme_config: typeof t.theme_config === 'string' ? JSON.parse(t.theme_config || '{}') : t.theme_config,
          plan_features: typeof t.plan_features === 'string' ? JSON.parse(t.plan_features || '{}') : (t.plan_features || {}),
          stats: {
            total_santri: Number(santriCount?.count || 0),
            total_guru: Number(guruCount?.count || 0),
          },
        };
      })
    );

    return paginated
      ? { items: tenantsWithCounts, total, page: pageNum, per_page: pageSize, counts }
      : tenantsWithCounts;
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
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
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
      santri_quota: resolveSantriQuota(tenant),
      theme_config: typeof tenant.theme_config === 'string' ? JSON.parse(tenant.theme_config || '{}') : tenant.theme_config,
      plan_features: typeof tenant.plan_features === 'string' ? JSON.parse(tenant.plan_features || '{}') : tenant.plan_features,
      stats: {
        total_santri: Number(santriCount?.count || 0),
        total_guru: Number(guruCount?.count || 0),
      },
    };
  }

  async createTenant(data) {
    const { name, subdomain, plan_id, admin_name, admin_email, admin_password, theme_config, subscription_expires_at, phone, address, institution_type, has_wali, member_label } = data;

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

    const instType = institution_type === 'non_pesantren' ? 'non_pesantren' : 'pesantren';
    const isWaliEnabled = has_wali !== undefined ? Boolean(has_wali) : (instType === 'pesantren');
    const label = member_label || (instType === 'non_pesantren' ? 'Peserta' : 'Santri');

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
      institution_type: instType,
      has_wali: isWaliEnabled,
      member_label: label,
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
      institution_type,
      has_wali,
      member_label,
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

    // Verify OTP requirement
    const recentOtp = await db('otp_verifications')
      .where({
        email: admin_email.toLowerCase().trim(),
        type: 'registration',
        is_verified: true,
      })
      .where('updated_at', '>=', new Date(Date.now() - 30 * 60 * 1000))
      .first();

    if (!recentOtp) {
      if (data.otp_code) {
        await authService.verifyOtp(admin_email, data.otp_code, 'registration');
      } else {
        const err = new Error('Email belum diverifikasi dengan kode OTP 6 digit. Silakan verifikasi email Anda terlebih dahulu.');
        err.statusCode = 400;
        throw err;
      }
    }

    // Get chosen package
    const pkg = await db('packages').where({ id: plan_id || 1 }).first();
    const effectivePlanId = pkg ? pkg.id : 1;
    const baseCapacity = pkg ? Number(pkg.max_santri) : 10;
    const basePrice = pkg ? Number(pkg.price) : 50000;
    const extraPricePerUser = pkg ? Number(pkg.extra_price_per_user || 0) : 0;
    const durationMonths = pkg ? Number(pkg.duration_months || 1) : 1;

    // Santri count calculation (base capacity + extra santri)
    const pkgFeatures = pkg?.features ? (typeof pkg.features === 'string' ? JSON.parse(pkg.features) : pkg.features) : {};
    const isPerUser = pkgFeatures?.pricing_type === 'per_user';
    const santriCount = data.requested_santri_count ? Math.max(1, Number(data.requested_santri_count)) : baseCapacity;
    let extraSantri = 0;
    let calculatedTotal = basePrice;

    if (isPerUser) {
      calculatedTotal = santriCount * basePrice;
    } else {
      extraSantri = Math.max(0, santriCount - baseCapacity);
      calculatedTotal = basePrice + (extraSantri * extraPricePerUser);
    }

    const defaultTheme = {
      primaryColor: '#059669',
      institutionName: name,
    };

    const instType = institution_type === 'non_pesantren' ? 'non_pesantren' : 'pesantren';
    const isWaliEnabled = has_wali !== undefined ? Boolean(has_wali) : (instType === 'pesantren');
    const label = member_label || (instType === 'non_pesantren' ? 'Peserta' : 'Santri');

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
      requested_santri_count: santriCount,
      total_price: calculatedTotal,
      duration_months: durationMonths,
      institution_type: instType,
      has_wali: isWaliEnabled,
      member_label: label,
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

    const superAdminWa = brand.supportWhatsApp;
    const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(calculatedTotal);
    const durationLabel = durationMonths === 12 ? '1 Tahun' : durationMonths === 6 ? '6 Bulan' : `${durationMonths} Bulan`;
    const santriInfo = extraSantri > 0
      ? `• Kuota Santri: ${santriCount} Orang (${baseCapacity} Kuota Dasar + ${extraSantri} Santri Tambahan)\n• Rincian Biaya: Dasar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(basePrice)} + Tambahan (${extraSantri} × ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(extraPricePerUser)})`
      : `• Kuota Santri: ${santriCount} Orang`;

    const categoryInfo = instType === 'non_pesantren'
      ? '• Kategori Lembaga: Non-Pesantren (Belajar Mandiri / Tanpa Wali)'
      : '• Kategori Lembaga: Pesantren / Sekolah Islam (Dengan Wali Santri)';

    const waTemplate = encodeURIComponent(
      `Halo Super Admin ${brand.name},\n\nSaya ingin konfirmasi pendaftaran lembaga baru:\n• Lembaga: ${name}\n${categoryInfo}\n• Subdomain: ${cleanSubdomain}.${brand.rootDomain}\n• Paket: ${pkg ? pkg.name : 'Paket Langganan'} (${durationLabel})\n${santriInfo}\n• Total Pembayaran: ${formattedPrice}\n• PIC / Admin: ${admin_name} (${admin_phone})\n• Email: ${admin_email}\n\nSaya sudah melakukan transfer pembayaran manual. Berikut saya lampirkan bukti transfernya. Mohon bantuannya untuk aktivasi akun lembaga kami. Terima kasih!`
    );

    const waLink = `https://wa.me/${superAdminWa.replace(/[^0-9]/g, '')}?text=${waTemplate}`;

    return {
      tenant_id: tenantId,
      name,
      subdomain: cleanSubdomain,
      status: 'pending_approval',
      requested_santri_count: santriCount,
      duration_months: durationMonths,
      total_price: calculatedTotal,
      package: pkg
        ? {
            id: pkg.id,
            name: pkg.name,
            code: pkg.code,
            price: pkg.price,
            max_santri: pkg.max_santri,
            duration_months: durationMonths,
            extra_price_per_user: extraPricePerUser,
          }
        : null,
      payment: {
        method: payment_method || 'manual_transfer',
        amount: calculatedTotal,
        amount_formatted: formattedPrice,
        bank_accounts: brand.bankAccounts,
        whatsapp_confirmation_url: waLink,
        whatsapp_number: superAdminWa,
      },
      message: 'Pendaftaran lembaga berhasil dikirim. Silakan selesaikan pembayaran dan kirim bukti transfer ke WhatsApp Super Admin untuk aktivasi.',
    };
  }

  /**
   * Super Admin approves a pending tenant
   */
  async approveTenant(id, { extend_months, notes } = {}) {
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.id', id)
      .select('tenants.*', 'packages.duration_months as pkg_duration_months')
      .first();
    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const defaultMonths = tenant.duration_months || tenant.pkg_duration_months || 1;
    const months = extend_months !== undefined && Number(extend_months) > 0 ? Number(extend_months) : defaultMonths;
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
    const { name, plan_id, status, theme_config, subscription_expires_at, extend_months, phone, address, payment_status, payment_proof_note, institution_type, has_wali, member_label } = data;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (plan_id !== undefined) updatePayload.plan_id = plan_id;
    if (status) updatePayload.status = status;
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;
    if (payment_status !== undefined) updatePayload.payment_status = payment_status;
    if (payment_proof_note !== undefined) updatePayload.payment_proof_note = payment_proof_note;
    if (institution_type !== undefined) updatePayload.institution_type = institution_type;
    if (has_wali !== undefined) updatePayload.has_wali = Boolean(has_wali);
    if (member_label !== undefined) updatePayload.member_label = member_label;
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

  /**
   * Gambaran kuota tenant: kuota efektif, jumlah terpakai, dan fungsi hitung tagihan.
   */
  async getQuotaSnapshot(tenantId) {
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.id', tenantId)
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
        'packages.features as plan_features'
      )
      .first();

    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const usedRow = await db('santri').where({ tenant_id: tenantId }).count('id as count').first();
    return {
      tenant,
      used: Number(usedRow?.count || 0),
      quota: resolveSantriQuota(tenant),
      priceFor: (quota) => computePeriodPrice(tenant, quota),
    };
  }

  /**
   * Tambah kuota santri/peserta tenant yang sedang berlangganan.
   * Gunakan add_santri (jumlah tambahan) atau new_quota (total kuota baru).
   * Mengembalikan tagihan tambahan per periode langganan berdasarkan harga paket.
   */
  async addSantriQuota(id, { add_santri, new_quota } = {}) {
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.id', id)
      .select(
        'tenants.*',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
        'packages.features as plan_features'
      )
      .first();

    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const previousQuota = resolveSantriQuota(tenant);
    const hasNewQuota = new_quota !== undefined && new_quota !== null && new_quota !== '';
    const targetQuota = hasNewQuota
      ? Math.floor(Number(new_quota))
      : previousQuota + Math.floor(Number(add_santri));

    if (!Number.isFinite(targetQuota) || targetQuota <= previousQuota) {
      const err = new Error(`Kuota baru harus lebih besar dari kuota saat ini (${previousQuota}).`);
      err.statusCode = 400;
      throw err;
    }

    const calcPrice = (quota) => computePeriodPrice(tenant, quota);

    const priceBefore = calcPrice(previousQuota);
    const priceAfter = calcPrice(targetQuota);

    await db('tenants').where({ id }).update({
      requested_santri_count: targetQuota,
      total_price: priceAfter,
      updated_at: db.fn.now(),
    });

    const updated = await this.getTenantById(id);
    return {
      tenant: updated,
      previous_quota: previousQuota,
      new_quota: targetQuota,
      added_santri: targetQuota - previousQuota,
      additional_price: Math.max(0, priceAfter - priceBefore),
      new_total_price: priceAfter,
      message: `Kuota berhasil ditambah dari ${previousQuota} menjadi ${targetQuota}.`,
    };
  }

  async deleteTenant(id) {
    await db('tenants').where({ id }).del();
    return true;
  }

  async getTenantBySubdomain(subdomain) {
    const cleanSub = String(subdomain || '').trim().toLowerCase();
    const tenant = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .where('tenants.subdomain', cleanSub)
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.code as plan_code',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
        'packages.features as plan_features'
      )
      .first();

    if (!tenant) {
      const err = new Error('Institusi dengan subdomain tersebut tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const santriCount = await db('santri').where({ tenant_id: tenant.id }).count('id as count').first();
    const guruCount = await db('users').where({ tenant_id: tenant.id, role: 'guru' }).count('id as count').first();
    const subMeta = getSubscriptionMeta(tenant);

    return {
      ...tenant,
      ...subMeta,
      santri_quota: resolveSantriQuota(tenant),
      theme_config: typeof tenant.theme_config === 'string' ? JSON.parse(tenant.theme_config || '{}') : tenant.theme_config,
      plan_features: typeof tenant.plan_features === 'string' ? JSON.parse(tenant.plan_features || '{}') : (tenant.plan_features || {}),
      stats: {
        total_santri: Number(santriCount?.count || 0),
        total_guru: Number(guruCount?.count || 0),
      },
    };
  }

  /**
   * Super Admin Executive Platform Summary & Live Metrics Cockpit
   */
  async getPlatformSummary() {
    const tenants = await db('tenants')
      .leftJoin('packages', 'tenants.plan_id', 'packages.id')
      .select(
        'tenants.*',
        'packages.name as plan_name',
        'packages.code as plan_code',
        'packages.price as plan_price',
        'packages.max_santri as plan_max_santri',
        'packages.extra_price_per_user as plan_extra_price_per_user',
        'packages.features as plan_features'
      )
      .orderBy('tenants.created_at', 'desc');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let totalSantri = 0;
    let totalGuru = 0;
    let totalHafalanGlobal = 0;
    let totalTahsinGlobal = 0;
    let mrr = 0;
    let activeCount = 0;
    let pendingCount = 0;
    let suspendedCount = 0;
    let expiringSoonCount = 0;

    const expiringSoonList = [];
    const pendingList = [];

    const enrichedTenants = await Promise.all(
      tenants.map(async (t) => {
        const santriCount = await db('santri').where({ tenant_id: t.id }).count('id as count').first();
        const guruCount = await db('users').where({ tenant_id: t.id, role: 'guru' }).count('id as count').first();
        const hafalanCount = await db('hafalan_histories').where({ tenant_id: t.id }).count('id as count').first();
        const adminUser = await db('users').where({ tenant_id: t.id, role: 'admin_tenant' }).first();
        const subMeta = getSubscriptionMeta(t);

        const numSantri = Number(santriCount?.count || 0);
        const numGuru = Number(guruCount?.count || 0);
        const numHafalan = Number(hafalanCount?.count || 0);

        totalSantri += numSantri;
        totalGuru += numGuru;
        totalHafalanGlobal += numHafalan;

        const planFeatures = typeof t.plan_features === 'string' ? JSON.parse(t.plan_features || '{}') : (t.plan_features || {});
        const expectedPrice = computePeriodPrice(t, resolveSantriQuota(t));

        const tenantData = {
          ...t,
          admin_name: adminUser?.name || null,
          admin_email: t.email || adminUser?.email || null,
          admin_phone: t.phone || adminUser?.phone || null,
          ...subMeta,
          santri_quota: resolveSantriQuota(t),
          stats: {
            total_santri: numSantri,
            total_guru: numGuru,
            total_hafalan: numHafalan,
          },
          expected_amount: expectedPrice,
          theme_config: typeof t.theme_config === 'string' ? JSON.parse(t.theme_config || '{}') : t.theme_config,
          plan_features: planFeatures,
        };

        if (t.status === 'active') {
          activeCount++;
          mrr += expectedPrice;
          if (subMeta.is_expiring_soon || (subMeta.days_remaining !== null && subMeta.days_remaining <= 7)) {
            expiringSoonCount++;
            expiringSoonList.push(tenantData);
          }
        } else if (t.status === 'pending_approval') {
          pendingCount++;
          pendingList.push(tenantData);
        } else if (t.status === 'suspended') {
          suspendedCount++;
        }

        return tenantData;
      })
    );

    // Global Counts
    const hafalanTotalRow = await db('hafalan_histories').count('id as count').first();
    const tahsinTotalRow = await db('tahsin_submissions').count('id as count').first();
    const todayHafalanRow = await db('hafalan_histories').where('date_recorded', todayStr).count('id as count').first();

    // Recent 6 Setoran Hafalan Live
    const recentActivity = await db('hafalan_histories')
      .leftJoin('santri', 'hafalan_histories.santri_id', 'santri.id')
      .leftJoin('tenants', 'hafalan_histories.tenant_id', 'tenants.id')
      .select(
        'hafalan_histories.id',
        'hafalan_histories.type',
        'hafalan_histories.surah_name',
        'hafalan_histories.verse_start',
        'hafalan_histories.verse_end',
        'hafalan_histories.grade',
        'hafalan_histories.created_at',
        'santri.full_name as santri_name',
        'tenants.name as tenant_name',
        'tenants.subdomain as tenant_subdomain'
      )
      .orderBy('hafalan_histories.id', 'desc')
      .limit(6);

    return {
      metrics: {
        total_tenants: tenants.length,
        active_tenants: activeCount,
        pending_tenants: pendingCount,
        suspended_tenants: suspendedCount,
        expiring_soon_tenants: expiringSoonCount,
        total_santri: totalSantri,
        total_guru: totalGuru,
        total_hafalan: Number(hafalanTotalRow?.count || totalHafalanGlobal),
        total_tahsin: Number(tahsinTotalRow?.count || 0),
        today_hafalan: Number(todayHafalanRow?.count || 0),
        mrr,
        arr: mrr * 12,
      },
      expiring_soon_list: expiringSoonList,
      pending_approval_list: pendingList,
      recent_activity: recentActivity,
      tenants: enrichedTenants,
    };
  }
}

module.exports = new TenantsService();
