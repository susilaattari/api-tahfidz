exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('schedules');
  if (!hasTable) return;

  try {
    await knex.schema.alterTable('schedules', (table) => {
      table.index(['tenant_id', 'class_id', 'day'], 'schedules_tenant_class_day_idx');
    });
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('already exists')) {
      throw error;
    }
  }
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('schedules');
  if (!hasTable) return;

  try {
    await knex.schema.alterTable('schedules', (table) => {
      table.dropIndex(['tenant_id', 'class_id', 'day'], 'schedules_tenant_class_day_idx');
    });
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('does not exist')) {
      throw error;
    }
  }
};
