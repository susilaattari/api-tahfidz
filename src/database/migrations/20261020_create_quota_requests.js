/**
 * Migration: Create quota_requests table
 * Admin tenant dapat mengajukan tambahan kuota santri/peserta saat sedang berlangganan.
 * Super admin menyetujui atau menolak; saat disetujui kuota tenant otomatis bertambah.
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('quota_requests');
  if (hasTable) return;

  await knex.schema.createTable('quota_requests', (table) => {
    table.increments('id').primary();
    table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('requested_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('current_quota').notNullable().defaultTo(0);
    table.integer('requested_add').notNullable().defaultTo(0);
    table.integer('requested_total').notNullable().defaultTo(0);
    table.decimal('estimated_price', 12, 2).notNullable().defaultTo(0);
    table.text('note').nullable();
    table.string('status', 20).notNullable().defaultTo('pending'); // pending | approved | rejected | cancelled
    table.integer('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('review_note').nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamps(true, true);

    table.index(['tenant_id', 'status']);
    table.index(['status']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('quota_requests');
};
