const db = require('../../config/database');
const brand = require('../../config/brand');
const packagesService = require('../packages/packages.service');
const { getSubscriptionMeta } = require('../../jobs/subscriptionChecker.job');

class DashboardContentService {
  /**
   * Helper to replace placeholder tokens in strings
   */
  replacePlaceholders(text, tokens = {}) {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    for (const [key, val] of Object.entries(tokens)) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, val || '');
    }
    return result;
  }

  /**
   * Fetch public content adapted for a given subdomain or generic
   */
  async getPublicContent(subdomain) {
    let tenant = null;
    let tenantRow = null;

    if (subdomain && typeof subdomain === 'string') {
      const cleanSub = subdomain.trim().toLowerCase();
      tenantRow = await db('tenants')
        .leftJoin('packages', 'tenants.plan_id', 'packages.id')
        .where('tenants.subdomain', cleanSub)
        .select(
          'tenants.id',
          'tenants.name',
          'tenants.subdomain',
          'tenants.status',
          'tenants.institution_type',
          'tenants.member_label',
          'tenants.has_wali',
          'tenants.theme_config',
          'tenants.subscription_expires_at',
          'tenants.plan_id',
          'packages.name as plan_name',
          'packages.code as plan_code',
          'packages.price as plan_price',
          'packages.max_santri as plan_max_santri',
          'packages.features as plan_features'
        )
        .first();

      if (tenantRow) {
        const subMeta = getSubscriptionMeta(tenantRow);
        const santriCount = await db('santri').where({ tenant_id: tenantRow.id }).count('id as count').first();
        const guruCount = await db('users').where({ tenant_id: tenantRow.id, role: 'guru' }).count('id as count').first();

        tenant = {
          id: tenantRow.id,
          name: tenantRow.name,
          subdomain: tenantRow.subdomain,
          status: tenantRow.status,
          institution_type: tenantRow.institution_type || 'pesantren',
          member_label: tenantRow.member_label || (tenantRow.institution_type === 'non_pesantren' ? 'Peserta' : 'Santri'),
          has_wali: tenantRow.has_wali,
          theme_config: typeof tenantRow.theme_config === 'string' ? JSON.parse(tenantRow.theme_config || '{}') : tenantRow.theme_config,
          subscription_expires_at: tenantRow.subscription_expires_at,
          ...subMeta,
          current_plan: {
            id: tenantRow.plan_id,
            name: tenantRow.plan_name || 'Standar',
            code: tenantRow.plan_code || 'standard',
            price: Number(tenantRow.plan_price || 0),
            max_santri: Number(tenantRow.plan_max_santri || 0),
            features: typeof tenantRow.plan_features === 'string' ? JSON.parse(tenantRow.plan_features || '{}') : (tenantRow.plan_features || {}),
          },
          stats: {
            total_santri: Number(santriCount?.count || 0),
            total_guru: Number(guruCount?.count || 0),
          },
        };
      }
    }

    // Retrieve custom override for tenant or fallback to global default
    let contentRow = null;
    if (tenant) {
      contentRow = await db('dashboard_portal_contents').where({ tenant_id: tenant.id }).first();
    }
    if (!contentRow) {
      contentRow = await db('dashboard_portal_contents').whereNull('tenant_id').first();
    }
    // Fallback if table was emptied
    if (!contentRow) {
      contentRow = {
        welcome_title: 'Ahlan wa Sahlan, Selamat Datang di Portal {tenant_name}',
        welcome_subtitle: 'Platform Resmi Monitoring & Manajemen Hafalan Al-Qur\'an Terpadu',
        gratitude_message: 'Jazakumullah Khairan Katsiran kepada segenap Pengurus, Dewan Asatidz, Santri, dan seluruh Wali Santri yang telah mempercayakan pengelolaan tahfidz dan tahsin kepada kami.',
        announcement_badge: `Pesan Resmi Manajemen Pusat ${brand.name}`,
        superadmin_name: `Tim Kemitraan & Dukungan Superadmin ${brand.name}`,
        superadmin_phone: brand.supportWhatsApp,
        superadmin_email: brand.supportEmail,
        superadmin_office_hours: 'Senin - Sabtu: 08:00 - 17:00 WIB',
        upgrade_title: 'Upgrade Paket & Maksimalkan Kapasitas Institusi Anda',
        upgrade_description: 'Tingkatkan kuota santri tanpa batas, aktifkan modul LMS video & meet, sistem penilaian cepat (tap), e-sertifikat tasmi digital berbarcode, serta pendampingan teknis prioritas dari tim pusat.',
        upgrade_whatsapp_template: `Halo Tim Superadmin ${brand.name}, kami dari institusi {tenant_name} (Subdomain: {subdomain}) berencana untuk konsultasi dan upgrade ke paket {package_name}. Mohon informasi aktivasi dan rekening pembayarannya. Terima kasih!`,
        bank_transfer_info: brand.bankTransferInfo,
        show_packages: true,
        show_contact: true,
        show_upgrade_cta: true,
      };
    }

    // Token replacement values
    const tokens = {
      tenant_name: tenant?.name || `Keluarga Besar ${brand.name}`,
      subdomain: tenant?.subdomain || (subdomain || 'portal'),
      active_plan: tenant?.current_plan?.name || 'Paket Standar',
    };

    const formattedContent = {
      id: contentRow.id,
      is_custom_override: Boolean(contentRow.tenant_id),
      welcome_title: this.replacePlaceholders(contentRow.welcome_title, tokens),
      welcome_subtitle: this.replacePlaceholders(contentRow.welcome_subtitle, tokens),
      gratitude_message: this.replacePlaceholders(contentRow.gratitude_message, tokens),
      announcement_badge: this.replacePlaceholders(contentRow.announcement_badge, tokens),
      superadmin_name: contentRow.superadmin_name,
      superadmin_phone: contentRow.superadmin_phone,
      superadmin_email: contentRow.superadmin_email,
      superadmin_office_hours: contentRow.superadmin_office_hours,
      upgrade_title: this.replacePlaceholders(contentRow.upgrade_title, tokens),
      upgrade_description: this.replacePlaceholders(contentRow.upgrade_description, tokens),
      upgrade_whatsapp_template: contentRow.upgrade_whatsapp_template,
      bank_transfer_info: contentRow.bank_transfer_info,
      show_packages: Boolean(contentRow.show_packages),
      show_contact: Boolean(contentRow.show_contact),
      show_upgrade_cta: Boolean(contentRow.show_upgrade_cta),
    };

    // Get all available packages
    const allPackages = await packagesService.getAllPackages();

    return {
      tenant,
      content: formattedContent,
      packages: allPackages,
    };
  }

  /**
   * Superadmin: Get all content configurations (global + overrides + tenant options)
   */
  async getAdminContent() {
    let globalRow = await db('dashboard_portal_contents').whereNull('tenant_id').first();
    if (!globalRow) {
      const [newId] = await db('dashboard_portal_contents').insert({
        tenant_id: null,
        welcome_title: 'Ahlan wa Sahlan, Selamat Datang di Portal {tenant_name}',
        welcome_subtitle: 'Platform Resmi Monitoring & Manajemen Hafalan Al-Qur\'an Terpadu',
        gratitude_message: 'Jazakumullah Khairan Katsiran kepada segenap Pengurus, Dewan Asatidz, Santri, dan seluruh Wali Santri yang telah mempercayakan pengelolaan tahfidz dan tahsin kepada kami.',
        announcement_badge: `Pesan Resmi Manajemen Pusat ${brand.name}`,
        superadmin_name: `Tim Kemitraan & Dukungan Superadmin ${brand.name}`,
        superadmin_phone: brand.supportWhatsApp,
        superadmin_email: brand.supportEmail,
        superadmin_office_hours: 'Senin - Sabtu: 08:00 - 17:00 WIB',
        upgrade_title: 'Upgrade Paket & Maksimalkan Kapasitas Institusi Anda',
        upgrade_description: 'Tingkatkan kuota santri tanpa batas, aktifkan modul LMS video & meet, sistem penilaian cepat (tap), e-sertifikat tasmi digital berbarcode, serta pendampingan teknis prioritas dari tim pusat.',
        upgrade_whatsapp_template: `Halo Tim Superadmin ${brand.name}, kami dari institusi {tenant_name} (Subdomain: {subdomain}) berencana untuk konsultasi dan upgrade ke paket {package_name}. Mohon informasi aktivasi dan rekening pembayarannya. Terima kasih!`,
        bank_transfer_info: brand.bankTransferInfo,
        show_packages: true,
        show_contact: true,
        show_upgrade_cta: true,
      });
      globalRow = await db('dashboard_portal_contents').where({ id: newId }).first();
    }

    const overrides = await db('dashboard_portal_contents')
      .join('tenants', 'dashboard_portal_contents.tenant_id', 'tenants.id')
      .select('dashboard_portal_contents.*', 'tenants.name as tenant_name', 'tenants.subdomain as tenant_subdomain')
      .orderBy('dashboard_portal_contents.updated_at', 'desc');

    const allTenants = await db('tenants')
      .select('id', 'name', 'subdomain', 'status')
      .orderBy('name', 'asc');

    return {
      global: globalRow,
      overrides,
      all_tenants: allTenants,
    };
  }

  /**
   * Superadmin: Update global default content
   */
  async updateGlobalContent(data) {
    const payload = this.extractContentPayload(data);
    payload.updated_at = db.fn.now();

    const existing = await db('dashboard_portal_contents').whereNull('tenant_id').first();
    if (existing) {
      await db('dashboard_portal_contents').where({ id: existing.id }).update(payload);
    } else {
      payload.tenant_id = null;
      await db('dashboard_portal_contents').insert(payload);
    }

    return db('dashboard_portal_contents').whereNull('tenant_id').first();
  }

  /**
   * Superadmin: Upsert tenant specific override
   */
  async upsertTenantOverride(tenantId, data) {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) {
      const err = new Error('Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const payload = this.extractContentPayload(data);
    payload.updated_at = db.fn.now();

    const existing = await db('dashboard_portal_contents').where({ tenant_id: tenantId }).first();
    if (existing) {
      await db('dashboard_portal_contents').where({ id: existing.id }).update(payload);
    } else {
      payload.tenant_id = tenantId;
      await db('dashboard_portal_contents').insert(payload);
    }

    return db('dashboard_portal_contents')
      .join('tenants', 'dashboard_portal_contents.tenant_id', 'tenants.id')
      .where('dashboard_portal_contents.tenant_id', tenantId)
      .select('dashboard_portal_contents.*', 'tenants.name as tenant_name', 'tenants.subdomain as tenant_subdomain')
      .first();
  }

  /**
   * Superadmin: Delete tenant override to inherit global content
   */
  async deleteTenantOverride(tenantId) {
    await db('dashboard_portal_contents').where({ tenant_id: tenantId }).del();
    return true;
  }

  /**
   * Payload sanitizer
   */
  extractContentPayload(data) {
    const allowed = [
      'welcome_title',
      'welcome_subtitle',
      'gratitude_message',
      'announcement_badge',
      'superadmin_name',
      'superadmin_phone',
      'superadmin_email',
      'superadmin_office_hours',
      'upgrade_title',
      'upgrade_description',
      'upgrade_whatsapp_template',
      'bank_transfer_info',
      'show_packages',
      'show_contact',
      'show_upgrade_cta',
    ];

    const result = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'boolean') {
          result[key] = data[key];
        } else {
          result[key] = String(data[key]).trim();
        }
      }
    }
    return result;
  }
}

module.exports = new DashboardContentService();
