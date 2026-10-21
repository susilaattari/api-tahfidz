/**
 * Migration: Create user_push_tokens table for Push Notifications & Spaced Repetition
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('user_push_tokens');
  if (!hasTable) {
    await knex.schema.createTable('user_push_tokens', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('token', 255).notNullable();
      table.string('device_type', 50).defaultTo('unknown');
      table.timestamps(true, true);

      table.unique(['user_id', 'token']);
      table.index(['user_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_push_tokens');
};
