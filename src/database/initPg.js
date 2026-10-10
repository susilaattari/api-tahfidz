require('dotenv').config();
const { Client } = require('pg');
const knexConfig = require('../../knexfile');
const knex = require('knex');

async function initPostgres() {
  const isPg = knexConfig.client === 'pg';
  if (!isPg) {
    console.log(`ℹ️  DB_CLIENT is set to '${knexConfig.client}'. PostgreSQL initialization is only for pg.`);
    return;
  }

  const dbName = process.env.DB_NAME || 'tahfidz_saas';
  console.log(`🚀 Checking PostgreSQL database '${dbName}'...`);

  let masterClient;
  if (process.env.DATABASE_URL) {
    console.log(`📡 Using DATABASE_URL connection.`);
    if (
      process.env.DATABASE_URL.includes('host-cloud.com') ||
      process.env.DATABASE_URL.includes('example.com') ||
      process.env.DATABASE_URL.includes('username:password')
    ) {
      console.error(`\n⚠️  DATABASE_URL masih berupa contoh placeholder dummy ('host-cloud.com')!`);
      console.error(`👉 Jika Anda menggunakan Cloud Database (Supabase / Neon / Render / Railway):`);
      console.error(`   Ganti DATABASE_URL di file .env dengan connection string asli dari dashboard cloud Anda.`);
      console.error(`👉 Jika Anda ingin menggunakan PostgreSQL Lokal di laptop Anda:`);
      console.error(`   Komentari/hapus DATABASE_URL di file .env, lalu isi DB_PASSWORD dengan password postgres lokal Anda.\n`);
      process.exit(1);
    }
  } else {
    const password = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : '';
    if (!password) {
      console.error(`\n⚠️  DB_PASSWORD di .env masih kosong!`);
      console.error(`👉 PostgreSQL memerlukan password untuk user '${process.env.DB_USER || 'postgres'}'.`);
      console.error(`Silakan buka file saas-tahfidz-api/.env dan isi:`);
      console.error(`   DB_PASSWORD=password_postgres_anda`);
      console.error(`Atau jika menggunakan Cloud (Supabase/Neon), gunakan:`);
      console.error(`   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require\n`);
      process.exit(1);
    }
    masterClient = new Client({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : '',
      database: 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    try {
      await masterClient.connect();
      const checkRes = await masterClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (checkRes.rowCount === 0) {
        console.log(`⚙️  Database '${dbName}' not found. Creating database...`);
        // Note: CREATE DATABASE cannot be executed inside a prepared statement
        await masterClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Database '${dbName}' created successfully!`);
      } else {
        console.log(`✅ Database '${dbName}' already exists.`);
      }
    } catch (err) {
      console.error(`❌ Error verifying/creating database in PostgreSQL:`, err.message);
      if (err.code === '28P01') {
        console.error(`👉 Authentication failed. Please check your DB_USER and DB_PASSWORD in .env`);
      }
      process.exit(1);
    } finally {
      await masterClient.end();
    }
  }

  // Now run migrations and seeds using Knex
  console.log(`🔄 Running knex migrations on '${dbName}'...`);
  const db = knex(knexConfig);
  try {
    const [batchNo, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log(`✅ Migrations already up to date.`);
    } else {
      console.log(`✅ Batch ${batchNo} run: ${log.length} migrations applied:`);
      log.forEach((file) => console.log(`   - ${file}`));
    }

    console.log(`🌱 Running initial seeds...`);
    const [seedFiles] = await db.seed.run();
    if (seedFiles && seedFiles.length > 0) {
      console.log(`✅ Seeds applied successfully:`);
      seedFiles.forEach((file) => console.log(`   - ${file}`));
    } else {
      console.log(`✅ Seeds completed.`);
    }
    console.log(`\n🎉 PostgreSQL setup completed successfully! Ready for production.`);
  } catch (err) {
    console.error(`❌ Migration or Seed failed:`, err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

initPostgres();
