require('dotenv').config();
const path = require('path');

const client = process.env.DB_CLIENT || 'sqlite3';

const connection = client === 'sqlite3'
  ? {
      filename: path.resolve(__dirname, process.env.DB_FILENAME || './src/database/tahfidz.sqlite')
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tahfidz_saas'
    };

module.exports = {
  client,
  connection,
  useNullAsDefault: client === 'sqlite3',
  migrations: {
    directory: path.resolve(__dirname, 'src/database/migrations')
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/database/seeds')
  },
  pool: client === 'sqlite3' ? {
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    }
  } : {
    min: 2,
    max: 10
  }
};
