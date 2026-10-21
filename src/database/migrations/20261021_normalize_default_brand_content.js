const brand = require('../../config/brand');

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('dashboard_portal_contents');
  if (!hasTable) return;

  const row = await knex('dashboard_portal_contents').whereNull('tenant_id').first();
  if (!row) return;

  const updates = {};

  if (!row.announcement_badge || /Tahfidz Go/i.test(row.announcement_badge)) {
    updates.announcement_badge = `Pesan Resmi Manajemen Pusat ${brand.name}`;
  }
  if (!row.superadmin_name || /Tahfidz Go/i.test(row.superadmin_name)) {
    updates.superadmin_name = `Tim Kemitraan & Dukungan Superadmin ${brand.name}`;
  }
  if (!row.superadmin_phone || row.superadmin_phone === '6281234567890') {
    updates.superadmin_phone = brand.supportWhatsApp;
  }
  if (!row.superadmin_email || row.superadmin_email === 'support@tahfidzgo.com') {
    updates.superadmin_email = brand.supportEmail;
  }

  const legacyBankValues = [
    'Bank Syariah Indonesia (BSI)\nNo. Rekening: 7123456789\na.n. PT Tahfidz Go Indonesia',
    'Bank Syariah Indonesia (BSI)\nNo. Rekening: 7123456789\na.n. PT Quriva Indonesia',
    'Bank Syariah Indonesia (BSI)\nNo. Rekening: 7141-2345-67\na.n. PT SaaS Tahfidz Quran Digital',
  ];
  if (!row.bank_transfer_info || legacyBankValues.includes(row.bank_transfer_info)) {
    updates.bank_transfer_info = brand.bankTransferInfo;
  }
  if (row.upgrade_whatsapp_template && /Tahfidz Go/i.test(row.upgrade_whatsapp_template)) {
    updates.upgrade_whatsapp_template = `Halo Tim Superadmin ${brand.name}, kami dari institusi {tenant_name} (Subdomain: {subdomain}) berencana untuk konsultasi dan upgrade ke paket {package_name}. Mohon informasi aktivasi dan rekening pembayarannya. Terima kasih!`;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = knex.fn.now();
    await knex('dashboard_portal_contents').where({ id: row.id }).update(updates);
  }
};

exports.down = async function () {
  // Brand normalization is intentionally not reverted.
};
