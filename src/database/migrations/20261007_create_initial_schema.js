/**
 * Initial Database Schema Migration for SaaS Tahfidz & Tahsin Quran
 */

exports.up = async function(knex) {
  // 1. Packages (SaaS subscription plans)
  await knex.schema.createTable('packages', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable(); // Basic, Standard, Premium
    table.string('code', 50).notNullable().unique();
    table.decimal('price', 12, 2).defaultTo(0);
    table.integer('max_santri').defaultTo(100);
    table.text('features'); // JSON string describing enabled features
    table.timestamps(true, true);
  });

  // 2. Tenants (Pondok Pesantren / Sekolah)
  await knex.schema.createTable('tenants', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('subdomain', 100).notNullable().unique();
    table.integer('plan_id').unsigned().references('id').inTable('packages').onDelete('SET NULL');
    table.string('status', 20).defaultTo('active'); // active, suspended, trial
    table.text('theme_config'); // JSON string (colors, logo_url, app_title)
    table.timestamps(true, true);
  });

  // 3. Users (Super Admin, Tenant Admin, Guru, Wali Santri)
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').nullable();
    table.string('name', 150).notNullable();
    table.string('email', 150).notNullable().unique();
    table.string('phone', 30).nullable();
    table.string('password_hash', 255).notNullable();
    table.string('role', 30).notNullable(); // super_admin, admin_tenant, guru, wali_santri
    table.string('status', 20).defaultTo('active');
    table.string('avatar_url', 255).nullable();
    table.timestamps(true, true);
  });

  // 4. Classes (Halaqah / Rombel)
  await knex.schema.createTable('classes', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('guru_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('name', 100).notNullable();
    table.string('academic_year', 20).defaultTo('2026/2027');
    table.timestamps(true, true);
  });

  // 5. Santri
  await knex.schema.createTable('santri', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('wali_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('class_id').unsigned().references('id').inTable('classes').onDelete('SET NULL');
    table.string('nisn', 50).nullable();
    table.string('full_name', 150).notNullable();
    table.string('gender', 10).defaultTo('L'); // L / P
    table.decimal('total_juz_hafalan', 4, 1).defaultTo(0);
    table.timestamps(true, true);
  });

  // 6. Hafalan Histories (Ziyadah, Tasmi, Murojaah)
  await knex.schema.createTable('hafalan_histories', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
    table.integer('guru_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('type', 20).notNullable(); // ziyadah, tasmi, murojaah
    table.integer('juz').notNullable();
    table.integer('surah_number').notNullable();
    table.string('surah_name', 100).notNullable();
    table.integer('verse_start').notNullable();
    table.integer('verse_end').notNullable();
    table.string('grade', 20).defaultTo('Mumtaz'); // Mumtaz, Jayyid Jiddan, Jayyid, Maqbul
    table.text('notes').nullable();
    table.date('date_recorded').notNullable();
    table.timestamps(true, true);
  });

  // 7. Tahsin Submissions (Voice Notes)
  await knex.schema.createTable('tahsin_submissions', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
    table.integer('wali_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('guru_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('title', 150).notNullable();
    table.string('audio_url', 255).notNullable();
    table.integer('surah_number').notNullable();
    table.integer('verse_start').notNullable();
    table.integer('verse_end').notNullable();
    table.string('status', 20).defaultTo('pending'); // pending, reviewed
    table.integer('tajwid_score').nullable();
    table.integer('fluent_score').nullable();
    table.text('feedback_note').nullable();
    table.string('feedback_audio_url', 255).nullable();
    table.timestamps(true, true);
  });

  // 8. Badges (Gamification)
  await knex.schema.createTable('badges', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
    table.string('badge_code', 50).notNullable(); // STAR_TAJWID, JUZ_30, MUROJAAH_WARRIOR
    table.string('badge_name', 100).notNullable();
    table.text('description').nullable();
    table.string('icon_url', 255).nullable();
    table.timestamp('awarded_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });

  // 9. Certificates (E-Sertifikat Tasmi per Juz)
  await knex.schema.createTable('certificates', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
    table.string('certificate_no', 100).notNullable().unique();
    table.integer('juz_completed').notNullable();
    table.string('file_url', 255).notNullable();
    table.date('issued_date').notNullable();
    table.timestamps(true, true);
  });

  // 10. LMS Materials (Video YouTube & Google Meet)
  await knex.schema.createTable('lms_materials', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().references('id').inTable('tenants').onDelete('CASCADE').nullable();
    table.string('title', 150).notNullable();
    table.text('description').nullable();
    table.string('type', 20).defaultTo('video'); // video, live_meet, document
    table.string('content_url', 255).notNullable();
    table.boolean('is_global').defaultTo(false);
    table.timestamps(true, true);
  });

  // 11. Chat Messages (Class Group & Kajian)
  await knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('sender_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('class_id').unsigned().references('id').inTable('classes').onDelete('SET NULL').nullable();
    table.string('room_type', 30).defaultTo('class_group'); // class_group, kajian_channel
    table.text('message').notNullable();
    table.string('attachment_url', 255).nullable();
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('lms_materials');
  await knex.schema.dropTableIfExists('certificates');
  await knex.schema.dropTableIfExists('badges');
  await knex.schema.dropTableIfExists('tahsin_submissions');
  await knex.schema.dropTableIfExists('hafalan_histories');
  await knex.schema.dropTableIfExists('santri');
  await knex.schema.dropTableIfExists('classes');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
  await knex.schema.dropTableIfExists('packages');
};
