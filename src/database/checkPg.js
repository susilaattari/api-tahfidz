require('dotenv').config();
const knexConfig = require('../../knexfile');
const knex = require('knex');

async function checkDatabase() {
  const db = knex(knexConfig);
  try {
    console.log('\n=============================================================');
    console.log('📊 STATUS & RINGKASAN DATABASE TAHFIDZ');
    console.log('=============================================================');
    console.log(`Dialect  : ${knexConfig.client}`);
    console.log(`Database : ${knexConfig.connection?.database || knexConfig.connection?.filename}`);
    console.log(`Host     : ${knexConfig.connection?.host || 'local'}`);

    // Check all public tables in PostgreSQL or SQLite
    let tables = [];
    if (knexConfig.client === 'pg') {
      const res = await db.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      tables = res.rows.map((r) => r.table_name);
    } else {
      const res = await db.raw("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      tables = res.map((r) => r.name);
    }

    console.log(`\n📋 Daftar Tabel (${tables.length} tabel ditemukan):`);
    console.log('-------------------------------------------------------------');
    for (const table of tables) {
      const [{ count }] = await db(table).count('* as count');
      console.log(` • ${table.padEnd(25)} : ${count} baris data`);
    }

    console.log('\n👤 Contoh Data Pengguna (Tabel users):');
    console.log('-------------------------------------------------------------');
    const users = await db('users').select('id', 'name', 'email', 'role', 'status').limit(10);
    console.table(users);

    console.log('\n🏫 Data Lembaga/Tenant (Tabel tenants):');
    console.log('-------------------------------------------------------------');
    const tenants = await db('tenants').select('id', 'name', 'subdomain', 'status').limit(5);
    console.table(tenants);

    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Gagal memeriksa database:', err.message);
  } finally {
    await db.destroy();
  }
}

checkDatabase();
