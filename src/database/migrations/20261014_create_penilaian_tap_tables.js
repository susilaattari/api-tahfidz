/**
 * Penilaian Hafalan Cepat (Tap) — PRD §10
 *
 * - hafalan_histories : tambah client_id (anti-duplikat antrean offline), method, hitungan nilai, jejak koreksi
 * - penilaian_ayat    : nilai per ayat (LANCAR / TIDAK_LANCAR / BELUM_DINILAI)
 * - posisi_hafalan    : ayat hafalan berikutnya per santri & jenis (nomor ayat global 1–6236)
 * - log_koreksi       : siapa & kapan mengoreksi setoran, beserta sebelum/sesudah
 *
 * Aman dijalankan ulang (setiap perubahan dicek dulu).
 */
exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, builder) => {
    if (!(await knex.schema.hasColumn(table, column))) {
      await knex.schema.table(table, builder);
    }
  };

  const hadClientId = await knex.schema.hasColumn('hafalan_histories', 'client_id');
  await addColumnIfMissing('hafalan_histories', 'client_id', (t) => t.string('client_id', 100).nullable());
  await addColumnIfMissing('hafalan_histories', 'method', (t) => t.string('method', 20).nullable()); // 'tap' | null (manual)
  await addColumnIfMissing('hafalan_histories', 'lancar_count', (t) => t.integer('lancar_count').nullable());
  await addColumnIfMissing('hafalan_histories', 'tidak_lancar_count', (t) => t.integer('tidak_lancar_count').nullable());
  await addColumnIfMissing('hafalan_histories', 'belum_dinilai_count', (t) => t.integer('belum_dinilai_count').nullable());
  await addColumnIfMissing('hafalan_histories', 'corrected_at', (t) => t.timestamp('corrected_at').nullable());
  await addColumnIfMissing('hafalan_histories', 'corrected_by', (t) => t.integer('corrected_by').unsigned().nullable());

  // Satu client_id hanya boleh dipakai sekali per tenant (NULL boleh berulang)
  if (!hadClientId) {
    await knex.schema.table('hafalan_histories', (t) => t.unique(['tenant_id', 'client_id'], 'uq_hafalan_tenant_client'));
  }

  if (!(await knex.schema.hasTable('penilaian_ayat'))) {
    await knex.schema.createTable('penilaian_ayat', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.integer('setoran_id').unsigned().notNullable().references('id').inTable('hafalan_histories').onDelete('CASCADE');
      t.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
      t.integer('surah_number').notNullable();
      t.integer('ayat').notNullable();
      t.integer('ayat_global').notNullable(); // 1–6236
      t.string('nilai', 20).notNullable(); // LANCAR | TIDAK_LANCAR | BELUM_DINILAI
      t.text('catatan').nullable();
      t.timestamps(true, true);
      t.index(['setoran_id'], 'idx_penilaian_setoran');
      t.index(['santri_id', 'ayat_global'], 'idx_penilaian_santri_ayat');
    });
  }

  if (!(await knex.schema.hasTable('posisi_hafalan'))) {
    await knex.schema.createTable('posisi_hafalan', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.integer('santri_id').unsigned().notNullable().references('id').inTable('santri').onDelete('CASCADE');
      t.string('jenis', 20).notNullable(); // ziyadah | murojaah
      t.integer('ayat_berikutnya').notNullable(); // nomor ayat global
      t.string('arah', 10).notNullable().defaultTo('MAJU'); // MAJU | MUNDUR
      t.boolean('khatam').notNullable().defaultTo(false);
      t.integer('updated_by').unsigned().nullable();
      t.timestamps(true, true);
      t.unique(['santri_id', 'jenis'], 'uq_posisi_santri_jenis');
    });
  }

  if (!(await knex.schema.hasTable('log_koreksi'))) {
    await knex.schema.createTable('log_koreksi', (t) => {
      t.increments('id').primary();
      t.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.integer('setoran_id').unsigned().notNullable().references('id').inTable('hafalan_histories').onDelete('CASCADE');
      t.integer('diubah_oleh').unsigned().nullable();
      t.text('sebelum').nullable(); // JSON
      t.text('sesudah').nullable(); // JSON
      t.timestamp('waktu').defaultTo(knex.fn.now());
      t.index(['setoran_id'], 'idx_log_koreksi_setoran');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('log_koreksi');
  await knex.schema.dropTableIfExists('posisi_hafalan');
  await knex.schema.dropTableIfExists('penilaian_ayat');

  try {
    await knex.schema.table('hafalan_histories', (t) => t.dropUnique(['tenant_id', 'client_id'], 'uq_hafalan_tenant_client'));
  } catch (e) {
    /* abaikan */
  }
  for (const column of [
    'corrected_by',
    'corrected_at',
    'belum_dinilai_count',
    'tidak_lancar_count',
    'lancar_count',
    'method',
    'client_id',
  ]) {
    if (await knex.schema.hasColumn('hafalan_histories', column)) {
      await knex.schema.table('hafalan_histories', (t) => t.dropColumn(column));
    }
  }
};
