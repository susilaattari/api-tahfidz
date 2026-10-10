/**
 * Add LMS material creation permission flags to users
 * - can_create_lms_local: Controlled by Tenant Admin for local tenant materials
 * - can_create_lms_global: Controlled by Super Admin for global SaaS LMS Tahsin
 */
exports.up = async function(knex) {
  const hasLocal = await knex.schema.hasColumn('users', 'can_create_lms_local');
  if (!hasLocal) {
    await knex.schema.table('users', (table) => {
      table.boolean('can_create_lms_local').defaultTo(false);
    });
  }

  const hasGlobal = await knex.schema.hasColumn('users', 'can_create_lms_global');
  if (!hasGlobal) {
    await knex.schema.table('users', (table) => {
      table.boolean('can_create_lms_global').defaultTo(false);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('can_create_lms_local');
    table.dropColumn('can_create_lms_global');
  });
};
