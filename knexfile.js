require('dotenv').config();
const path = require('path');

const rawClient = process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'pg' : 'sqlite3');
const client = rawClient === 'postgresql' || rawClient === 'postgres' ? 'pg' : rawClient;

const isPg = client === 'pg';
const isSqlite = client === 'sqlite3';

// Ensure consistent insert ID behavior across PostgreSQL, SQLite, and MySQL
const QueryBuilder = require('knex/lib/query/querybuilder');
const originalInsert = QueryBuilder.prototype.insert;
QueryBuilder.prototype.insert = function(values, returning) {
  const tableName = String(this._single?.table || this._single?.from || '');
  if (tableName.includes('knex_migrations')) {
    return originalInsert.call(this, values, returning);
  }

  this.queryContext({ isInsert: true });
  if (this.client && (this.client.dialect === 'postgresql' || this.client.dialect === 'pg')) {
    if (!returning && (!this._single || !this._single.returning)) {
      returning = 'id';
    }
  }
  return originalInsert.call(this, values, returning);
};

const getConnection = () => {
  if (process.env.DATABASE_URL) {
    let connStr = process.env.DATABASE_URL;
    const isSsl = process.env.DB_SSL === 'true' || connStr.includes('sslmode=') || connStr.includes('ssl=true');
    if (connStr.includes('sslmode=require') && !connStr.includes('uselibpqcompat')) {
      connStr = connStr.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
    }
    return {
      connectionString: connStr,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
    };
  }

  if (isSqlite) {
    return {
      filename: path.resolve(__dirname, process.env.DB_FILENAME || './src/database/tahfidz.sqlite'),
    };
  }

  // PostgreSQL / MySQL
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || (isPg ? 5432 : 3306),
    user: process.env.DB_USER || (isPg ? 'postgres' : 'root'),
    password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : '',
    database: process.env.DB_NAME || 'tahfidz_saas',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

const config = {
  client,
  connection: getConnection(),
  useNullAsDefault: isSqlite,
  migrations: {
    directory: path.resolve(__dirname, 'src/database/migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/database/seeds'),
  },
  postProcessResponse: (result, queryContext) => {
    if (queryContext && queryContext.isInsert) {
      if (
        Array.isArray(result) &&
        result.length > 0 &&
        result[0] &&
        typeof result[0] === 'object' &&
        'id' in result[0]
      ) {
        return result.map((r) => r.id);
      }
    }
    return result;
  },
  pool: isSqlite
    ? {
        afterCreate: (conn, cb) => {
          conn.run('PRAGMA foreign_keys = ON', cb);
        },
      }
    : {
        min: Number(process.env.DB_POOL_MIN) || 2,
        max: Number(process.env.DB_POOL_MAX) || 10,
      },
};

module.exports = {
  ...config,
  development: config,
  production: config,
  test: config,
};
