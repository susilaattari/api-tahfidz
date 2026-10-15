/**
 * Add registration and payment fields to tenants table
 * Supports self-service registration, manual transfer payment proof, and future Midtrans integration.
 */
exports.up = async function(knex) {
  const hasPhone = await knex.schema.hasColumn('tenants', 'phone');
  if (!hasPhone) {
    await knex.schema.table('tenants', (table) => {
      table.string('phone', 50).nullable();
    });
  }

  const hasEmail = await knex.schema.hasColumn('tenants', 'email');
  if (!hasEmail) {
    await knex.schema.table('tenants', (table) => {
      table.string('email', 150).nullable();
    });
  }

  const hasAddress = await knex.schema.hasColumn('tenants', 'address');
  if (!hasAddress) {
    await knex.schema.table('tenants', (table) => {
      table.string('address', 255).nullable();
    });
  }

  const hasPaymentMethod = await knex.schema.hasColumn('tenants', 'payment_method');
  if (!hasPaymentMethod) {
    await knex.schema.table('tenants', (table) => {
      table.string('payment_method', 50).defaultTo('manual_transfer');
    });
  }

  const hasPaymentStatus = await knex.schema.hasColumn('tenants', 'payment_status');
  if (!hasPaymentStatus) {
    await knex.schema.table('tenants', (table) => {
      table.string('payment_status', 30).defaultTo('pending');
    });
  }

  const hasPaymentProofNote = await knex.schema.hasColumn('tenants', 'payment_proof_note');
  if (!hasPaymentProofNote) {
    await knex.schema.table('tenants', (table) => {
      table.text('payment_proof_note').nullable();
    });
  }

  const hasRejectionReason = await knex.schema.hasColumn('tenants', 'rejection_reason');
  if (!hasRejectionReason) {
    await knex.schema.table('tenants', (table) => {
      table.text('rejection_reason').nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('tenants', (table) => {
    table.dropColumn('rejection_reason');
    table.dropColumn('payment_proof_note');
    table.dropColumn('payment_status');
    table.dropColumn('payment_method');
    table.dropColumn('address');
    table.dropColumn('email');
    table.dropColumn('phone');
  });
};
