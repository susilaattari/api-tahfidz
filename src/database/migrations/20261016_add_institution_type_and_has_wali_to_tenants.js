/**
 * Add institution_type, has_wali, and member_label to tenants table
 * Supports both Pesantren (with wali accompaniment) and Non-Pesantren (community, self-learning without wali)
 */
exports.up = async function(knex) {
  const hasInstType = await knex.schema.hasColumn('tenants', 'institution_type');
  if (!hasInstType) {
    await knex.schema.table('tenants', (table) => {
      table.string('institution_type', 50).defaultTo('pesantren'); // 'pesantren' | 'non_pesantren'
    });
  }

  const hasWali = await knex.schema.hasColumn('tenants', 'has_wali');
  if (!hasWali) {
    await knex.schema.table('tenants', (table) => {
      table.boolean('has_wali').defaultTo(true); // true = with wali, false = without wali
    });
  }

  const hasMemberLabel = await knex.schema.hasColumn('tenants', 'member_label');
  if (!hasMemberLabel) {
    await knex.schema.table('tenants', (table) => {
      table.string('member_label', 50).defaultTo('Santri'); // 'Santri' | 'Peserta'
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('member_label');
    table.dropColumn('has_wali');
    table.dropColumn('institution_type');
  });
};
