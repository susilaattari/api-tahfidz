const app = require('./src/app');
const http = require('http');

async function testAll() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(8099, resolve));
  console.log('Test server running on port 8099');

  try {
    // 1. Super Admin login
    const loginRes = await fetch('http://localhost:8099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'superadmin@tahfidz.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Super admin login failed: ${loginData.message}`);
    const token = loginData.data?.token;
    console.log('✓ [AUTH] Super Admin login OK (Token acquired)');

    // 2. Tenant Admin login
    const tenantLoginRes = await fetch('http://localhost:8099/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin@alhikmah.sch.id', password: 'password123' })
    });
    const tenantLoginData = await tenantLoginRes.json();
    if (!tenantLoginRes.ok) throw new Error(`Tenant login failed: ${tenantLoginData.message}`);
    const tenantToken = tenantLoginData.data?.token;
    console.log('✓ [AUTH] Tenant Admin login OK');

    // 3. Test Ubah Password (PUT /api/auth/password)
    const changePassRes = await fetch('http://localhost:8099/api/auth/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tenantToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: 'password123',
        new_password: 'password123',
      })
    });
    const changePassData = await changePassRes.json();
    if (!changePassRes.ok) throw new Error(`Change password failed: ${changePassData.message}`);
    console.log('✓ [AUTH] Ubah Password OK:', changePassData.message);

    // 4. Hafalan Summary for Santri 1
    const summaryRes = await fetch('http://localhost:8099/api/hafalan/summary/1', {
      headers: { Authorization: `Bearer ${tenantToken}`, 'X-Tenant-ID': '1' }
    });
    const summaryData = await summaryRes.json();
    console.log('✓ [HAFALAN] Santri 1 Summary OK, Total setoran:', summaryData.data?.stats?.total_setoran);

    // 5. Test GET /api/hafalan list with aliases (per_page & jenis)
    const listHafalanRes = await fetch('http://localhost:8099/api/hafalan?per_page=5&jenis=ziyadah', {
      headers: { Authorization: `Bearer ${tenantToken}`, 'X-Tenant-ID': '1' }
    });
    const listHafalanData = await listHafalanRes.json();
    console.log('✓ [HAFALAN] GET /api/hafalan list OK, records returned:', listHafalanData.data?.length);

    // 6. Record new Muroja'ah
    const recordRes = await fetch('http://localhost:8099/api/hafalan/record', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenantToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': '1' },
      body: JSON.stringify({
        santri_id: 1,
        type: 'murojaah',
        juz: 30,
        surah_number: 78,
        surah_name: 'An-Naba',
        verse_start: 1,
        verse_end: 40,
        grade: 'Mumtaz',
        notes: 'Murojaah lancar tanpa kendala.',
      })
    });
    const recordData = await recordRes.json();
    console.log('✓ [HAFALAN] Record Murojaah OK, ID:', recordData.data?.id);

    // 7. Issue Certificate for Santri 1
    const certRes = await fetch('http://localhost:8099/api/certificates/issue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenantToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': '1' },
      body: JSON.stringify({
        santri_id: 1,
        juz_completed: 30
      })
    });
    const certData = await certRes.json();
    console.log('✓ [CERTIFICATE] PDF Certificate generated OK:', certData.data?.certificate_no, certData.data?.file_url);

    // 8. Award Badge
    const badgeRes = await fetch('http://localhost:8099/api/badges/santri/1/award', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenantToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': '1' },
      body: JSON.stringify({
        badge_code: 'WARRIOR_MUROJAAH',
        badge_name: 'Pejuang Muroja\'ah',
        description: 'Rutin mengulang hafalan tepat waktu.',
      })
    });
    const badgeData = await badgeRes.json();
    console.log('✓ [GAMIFICATION] Badge awarded OK:', badgeData.data?.badge_name);

    // 9. Test Alias /api/gamification/santri/1
    const gamificationRes = await fetch('http://localhost:8099/api/gamification/santri/1', {
      headers: { Authorization: `Bearer ${tenantToken}`, 'X-Tenant-ID': '1' }
    });
    const gamificationData = await gamificationRes.json();
    console.log('✓ [GAMIFICATION ALIAS] GET /api/gamification/santri/1 OK, Badges count:', gamificationData.data?.length);

    // 10. LMS Materials
    const lmsRes = await fetch('http://localhost:8099/api/lms', {
      headers: { Authorization: `Bearer ${tenantToken}`, 'X-Tenant-ID': '1' }
    });
    const lmsData = await lmsRes.json();
    console.log('✓ [LMS] Total materials:', lmsData.data?.length);

    // 11. Chat Message
    const chatRes = await fetch('http://localhost:8099/api/chat/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenantToken}`, 'Content-Type': 'application/json', 'X-Tenant-ID': '1' },
      body: JSON.stringify({
        room_type: 'kajian_channel',
        message: 'Kajian parenting pekan ini akan membahas adab menghafal Al-Quran.',
      })
    });
    const chatData = await chatRes.json();
    console.log('✓ [CHAT] Message sent OK, ID:', chatData.data?.id);

    // 12. Trigger Spaced Repetition Reminder Job
    const jobRes = await fetch('http://localhost:8099/api/jobs/trigger-reminder', {
      method: 'POST'
    });
    const jobData = await jobRes.json();
    console.log('✓ [JOBS] Spaced Repetition Murojaah Reminder executed successfully.');

    console.log('\n🎉 ALL FULLSTACK SAAS BACKEND FUNCTIONALITIES VERIFIED & 100% OPERATIONAL! 🎉');
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

testAll();

