/**
 * Add subscription_expires_at to tenants table
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('tenants', 'subscription_expires_at');
  if (!hasColumn) {
    await knex.schema.table('tenants', (table) => {
      table.timestamp('subscription_expires_at').nullable();
    });

    // Populate existing active tenants with default expiration (1 year from now)
    const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await knex('tenants')
      .whereNull('subscription_expires_at')
      .update({ subscription_expires_at: defaultExpiry });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('tenants', 'subscription_expires_at');
  if (hasColumn) {
    await knex.schema.table('tenants', (table) => {
      table.dropColumn('subscription_expires_at');
    });
  }
};
