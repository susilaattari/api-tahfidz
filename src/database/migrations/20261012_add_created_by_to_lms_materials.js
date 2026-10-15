/**
 * Add created_by and author_name to lms_materials table
 */
exports.up = async function(knex) {
  const hasCreatedBy = await knex.schema.hasColumn('lms_materials', 'created_by');
  if (!hasCreatedBy) {
    await knex.schema.table('lms_materials', (table) => {
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    });
  }

  const hasAuthorName = await knex.schema.hasColumn('lms_materials', 'author_name');
  if (!hasAuthorName) {
    await knex.schema.table('lms_materials', (table) => {
      table.string('author_name', 150).nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasAuthorName = await knex.schema.hasColumn('lms_materials', 'author_name');
  if (hasAuthorName) {
    await knex.schema.table('lms_materials', (table) => {
      table.dropColumn('author_name');
    });
  }

  const hasCreatedBy = await knex.schema.hasColumn('lms_materials', 'created_by');
  if (hasCreatedBy) {
    await knex.schema.table('lms_materials', (table) => {
      table.dropColumn('created_by');
    });
  }
};
