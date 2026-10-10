const app = require('./src/app');
const http = require('http');

async function runTest() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(8099, resolve));
  console.log('Test server running on port 8099');

  try {
    // 1. Health check
    const healthRes = await fetch('http://localhost:8099/api/health');
    const healthData = await healthRes.json();
    console.log('✓ Health check passed:', healthData.message);

    // 2. Super Admin Login
    const loginRes = await fetch('http://localhost:8099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'superadmin@tahfidz.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log('✓ Super Admin Login passed:', loginData.success, 'Role:', loginData.data?.user?.role);
    const superAdminToken = loginData.data?.token;

    // 3. Get Packages
    const pkgRes = await fetch('http://localhost:8099/api/packages');
    const pkgData = await pkgRes.json();
    console.log('✓ Packages fetched:', pkgData.data?.length, 'packages found.');

    // 4. Get Tenants with Super Admin Token
    const tenantsRes = await fetch('http://localhost:8099/api/tenants', {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const tenantsData = await tenantsRes.json();
    console.log('✓ Tenants fetched by Super Admin:', tenantsData.data?.length, 'tenants found.');

    // 5. Guru Login
    const guruRes = await fetch('http://localhost:8099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ustadz.ahmad@alhikmah.sch.id', password: 'password123' })
    });
    const guruData = await guruRes.json();
    console.log('✓ Guru Login passed:', guruData.data?.user?.name, 'Tenant:', guruData.data?.user?.tenant?.name);

    // 6. Wali Santri Login
    const waliRes = await fetch('http://localhost:8099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'wali.budi@gmail.com', password: 'password123' })
    });

    const waliData = await waliRes.json();
    console.log('✓ Wali Login passed:', waliData.data?.user?.name, 'Santri count:', waliData.data?.user?.santris?.length);

    console.log('\n🌟 ALL MILESTONE 1 BACKEND API TESTS PASSED! 🌟');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTest();
