/**
 * Dynamic Subscription Packages & Pricing by Duration (Monthly, 6 Months, Annual)
 *
 * Adds duration_months and extra_price_per_user to packages table,
 * as well as requested_santri_count, total_price, and duration_months to tenants table.
 */
exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, builder) => {
    if (!(await knex.schema.hasColumn(table, column))) {
      await knex.schema.table(table, builder);
    }
  };

  // Add dynamic pricing columns to packages
  await addColumnIfMissing('packages', 'duration_months', (t) => t.integer('duration_months').defaultTo(1));
  await addColumnIfMissing('packages', 'extra_price_per_user', (t) => t.decimal('extra_price_per_user', 12, 2).defaultTo(0));

  // Add registration quota & pricing columns to tenants
  await addColumnIfMissing('tenants', 'requested_santri_count', (t) => t.integer('requested_santri_count').nullable());
  await addColumnIfMissing('tenants', 'total_price', (t) => t.decimal('total_price', 12, 2).nullable());
  await addColumnIfMissing('tenants', 'duration_months', (t) => t.integer('duration_months').defaultTo(1));
};

exports.down = async function (knex) {
  const dropColumnIfExists = async (table, column) => {
    if (await knex.schema.hasColumn(table, column)) {
      await knex.schema.table(table, (t) => t.dropColumn(column));
    }
  };

  await dropColumnIfExists('packages', 'duration_months');
  await dropColumnIfExists('packages', 'extra_price_per_user');
  await dropColumnIfExists('tenants', 'requested_santri_count');
  await dropColumnIfExists('tenants', 'total_price');
  await dropColumnIfExists('tenants', 'duration_months');
};
