/**
 * Migration: Create user_consents table
 * Menyimpan persetujuan pengguna (kebijakan privasi dan rekaman suara anak).
 * Status approved = pengguna sudah menyetujui; revoked = persetujuan dicabut.
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('user_consents');
  if (hasTable) return;

  await knex.schema.createTable('user_consents', (table) => {
    table.increments('id').primary();
    table
      .integer('tenant_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('santri_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('santri')
      .onDelete('CASCADE');

    table.string('consent_type', 50).notNullable();
    table.string('document_version', 30).notNullable();
    table.string('status', 20).notNullable().defaultTo('approved'); // approved | revoked
    table.timestamp('agreed_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.string('ip_address', 72).nullable();
    table.text('user_agent').nullable();
    table.timestamps(true, true);

    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'consent_type']);
    table.index(['user_id', 'consent_type']);
    table.index(['santri_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_consents');
};
