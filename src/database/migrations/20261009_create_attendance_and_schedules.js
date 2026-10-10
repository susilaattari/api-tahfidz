/**
 * Migration for Attendances (Absensi Halaqah) and Schedules (Jadwal Halaqah)
 */

exports.up = async function(knex) {
  // 1. Table attendances (Absensi Halaqah Santri)
  const hasAttendances = await knex.schema.hasTable('attendances');
  if (!hasAttendances) {
    await knex.schema.createTable('attendances', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.integer('class_id').unsigned().nullable().references('id').inTable('classes').onDelete('SET NULL');
      table.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
      table.integer('guru_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.date('date').notNullable();
      table.string('status', 20).notNullable().defaultTo('hadir'); // hadir, sakit, izin, alpa
      table.text('notes').nullable();
      table.timestamps(true, true);
    });
  }

  // 2. Table schedules (Jadwal Kegiatan & Halaqah Tahfidz)
  const hasSchedules = await knex.schema.hasTable('schedules');
  if (!hasSchedules) {
    await knex.schema.createTable('schedules', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.integer('class_id').unsigned().nullable().references('id').inTable('classes').onDelete('SET NULL');
      table.integer('guru_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('day', 20).notNullable(); // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
      table.string('time_start', 10).notNullable(); // '05:30'
      table.string('time_end', 10).notNullable();   // '06:30'
      table.string('activity_name', 150).notNullable(); // 'Setoran Ziyadah Subuh'
      table.string('location', 100).defaultTo('Masjid Utama');
      table.text('description').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('schedules');
  await knex.schema.dropTableIfExists('attendances');
};
