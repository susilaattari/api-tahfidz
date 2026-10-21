/**
 * Migration: Create dashboard_portal_contents table
 * Stores customized welcome messages, gratitude notes, superadmin contact info,
 * and upgrade procedures configured by Super Admin for tenant subdomains and root dashboard.
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('dashboard_portal_contents');
  if (!hasTable) {
    await knex.schema.createTable('dashboard_portal_contents', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').nullable();
      table.string('welcome_title', 255).notNullable().defaultTo('Ahlan wa Sahlan, Selamat Datang di Portal {tenant_name}');
      table.string('welcome_subtitle', 255).notNullable().defaultTo('Platform Resmi Monitoring & Manajemen Hafalan Al-Qur\'an Terpadu');
      table.text('gratitude_message').notNullable().defaultTo('Jazakumullah Khairan Katsiran kepada segenap Pengurus, Dewan Asatidz, Santri, dan seluruh Wali Santri yang telah mempercayakan pengelolaan tahfidz dan tahsin kepada kami. Semoga setiap lantunan ayat suci Al-Qur\'an yang disetorkan menjadi amal jariyah yang terus mengalir.');
      table.string('announcement_badge', 150).notNullable().defaultTo('Pesan Resmi Manajemen Pusat Quriva');
      table.string('superadmin_name', 150).notNullable().defaultTo('Tim Kemitraan & Dukungan Superadmin Quriva');
      table.string('superadmin_phone', 50).notNullable().defaultTo('6281234567890');
      table.string('superadmin_email', 150).notNullable().defaultTo('support@quriva.id');
      table.string('superadmin_office_hours', 150).notNullable().defaultTo('Senin - Sabtu: 08:00 - 17:00 WIB');
      table.string('upgrade_title', 255).notNullable().defaultTo('Upgrade Paket & Maksimalkan Kapasitas Institusi Anda');
      table.text('upgrade_description').notNullable().defaultTo('Tingkatkan kuota santri tanpa batas, aktifkan modul LMS video & meet, sistem penilaian cepat (tap), e-sertifikat tasmi digital berbarcode, serta pendampingan teknis prioritas dari tim pusat.');
      table.text('upgrade_whatsapp_template').notNullable().defaultTo('Halo Tim Superadmin Tahfidz Go, kami dari institusi {tenant_name} (Subdomain: {subdomain}) berencana untuk konsultasi dan upgrade ke paket {package_name}. Mohon informasi aktivasi dan rekening pembayarannya. Terima kasih!');
      table.text('bank_transfer_info').nullable().defaultTo('Bank Syariah Indonesia (BSI)\nNo. Rekening: 7123456789\na.n. PT Tahfidz Go Indonesia');
      table.boolean('show_packages').notNullable().defaultTo(true);
      table.boolean('show_contact').notNullable().defaultTo(true);
      table.boolean('show_upgrade_cta').notNullable().defaultTo(true);
      table.timestamps(true, true);
    });

    // Seed default global content row (tenant_id = null)
    await knex('dashboard_portal_contents').insert({
      tenant_id: null,
      welcome_title: 'Ahlan wa Sahlan, Selamat Datang di Portal {tenant_name}',
      welcome_subtitle: 'Platform Resmi Monitoring & Manajemen Hafalan Al-Qur\'an Terpadu',
      gratitude_message: 'Jazakumullah Khairan Katsiran kepada segenap Pengurus, Dewan Asatidz, Santri, dan seluruh Wali Santri yang telah mempercayakan pengelolaan tahfidz dan tahsin kepada kami. Semoga setiap lantunan ayat suci Al-Qur\'an yang disetorkan menjadi amal jariyah yang terus mengalir.',
      announcement_badge: 'Pesan Resmi Manajemen Pusat Tahfidz Go',
      superadmin_name: 'Tim Kemitraan & Dukungan Superadmin Tahfidz Go',
      superadmin_phone: '6281234567890',
      superadmin_email: 'support@tahfidzgo.com',
      superadmin_office_hours: 'Senin - Sabtu: 08:00 - 17:00 WIB',
      upgrade_title: 'Upgrade Paket & Maksimalkan Kapasitas Institusi Anda',
      upgrade_description: 'Tingkatkan kuota santri tanpa batas, aktifkan modul LMS video & meet, sistem penilaian cepat (tap), e-sertifikat tasmi digital berbarcode, serta pendampingan teknis prioritas dari tim pusat.',
      upgrade_whatsapp_template: 'Halo Tim Superadmin Tahfidz Go, kami dari institusi {tenant_name} (Subdomain: {subdomain}) berencana untuk konsultasi dan upgrade ke paket {package_name}. Mohon informasi aktivasi dan rekening pembayarannya. Terima kasih!',
      bank_transfer_info: 'Bank Syariah Indonesia (BSI)\nNo. Rekening: 7123456789\na.n. PT Tahfidz Go Indonesia',
      show_packages: true,
      show_contact: true,
      show_upgrade_cta: true,
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('dashboard_portal_contents');
};
