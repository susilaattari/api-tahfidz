const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');

const db = knex(knexConfig);

// Verify database connection at startup
db.raw('SELECT 1+1 AS result')
  .then(() => {
    const dialect = db.client.dialect || knexConfig.client;
    const dbTarget = knexConfig.connection?.database || knexConfig.connection?.filename || 'default';
    logger.info(`📦 Database connected successfully: ${dialect} (${dbTarget})`);
  })
  .catch((err) => {
    logger.error(`❌ Database connection failed (${knexConfig.client}): ${err.message}`);
  });

module.exports = db;
