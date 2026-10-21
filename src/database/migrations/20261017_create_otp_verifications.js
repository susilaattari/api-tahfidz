/**
 * Migration: Create otp_verifications table
 * Used for 6-digit email OTP verification during registration & password reset
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('otp_verifications');
  if (!hasTable) {
    await knex.schema.createTable('otp_verifications', (table) => {
      table.increments('id').primary();
      table.string('email', 150).notNullable().index();
      table.string('otp_code', 10).notNullable();
      table.string('type', 50).defaultTo('registration'); // registration, login, reset_password
      table.timestamp('expires_at').notNullable();
      table.boolean('is_verified').defaultTo(false);
      table.integer('attempts').defaultTo(0);
      table.timestamps(true, true);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('otp_verifications');
};
