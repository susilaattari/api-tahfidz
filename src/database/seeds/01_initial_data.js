const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Clear tables in reverse dependency order
  await knex('attendances').del().catch(() => {});
  await knex('schedules').del().catch(() => {});
  await knex('chat_messages').del().catch(() => {});
  await knex('lms_materials').del().catch(() => {});
  await knex('certificates').del().catch(() => {});
  await knex('badges').del().catch(() => {});
  await knex('tahsin_submissions').del().catch(() => {});
  await knex('hafalan_histories').del().catch(() => {});
  await knex('santri').del().catch(() => {});
  await knex('classes').del().catch(() => {});
  await knex('users').del().catch(() => {});
  await knex('tenants').del().catch(() => {});
  await knex('packages').del().catch(() => {});

  // 1. Packages
  const [basicId, standardId, premiumId] = await knex('packages').insert([
    {
      name: 'Paket Grup Bulanan (1 Bulan)',
      code: 'monthly-10',
      price: 50000,
      max_santri: 10,
      duration_months: 1,
      extra_price_per_user: 5000,
      features: JSON.stringify({
        pricing_type: 'group_tiered',
        duration_months: 1,
        base_capacity: 10,
        extra_price_per_user: 5000,
        hafalan: true,
        tahsin_audio: true,
        badges: true,
        certificates: false,
        lms: false,
        chat: true,
        spaced_repetition: false,
      }),
    },
    {
      name: 'Paket Grup 6 Bulan',
      code: '6months-10',
      price: 300000,
      max_santri: 10,
      duration_months: 6,
      extra_price_per_user: 5000,
      features: JSON.stringify({
        pricing_type: 'group_tiered',
        duration_months: 6,
        base_capacity: 10,
        extra_price_per_user: 5000,
        hafalan: true,
        tahsin_audio: true,
        badges: true,
        certificates: true,
        lms: true,
        chat: true,
        spaced_repetition: false,
      }),
    },
    {
      name: 'Paket Grup 1 Tahun (Tahunan)',
      code: 'annual-10',
      price: 600000,
      max_santri: 10,
      duration_months: 12,
      extra_price_per_user: 5000,
      features: JSON.stringify({
        pricing_type: 'group_tiered',
        duration_months: 12,
        base_capacity: 10,
        extra_price_per_user: 5000,
        hafalan: true,
        tahsin_audio: true,
        badges: true,
        certificates: true,
        lms: true,
        chat: true,
        spaced_repetition: true,
      }),
    },
  ]);

  // 2. Tenants
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const [tenant1Id, tenant2Id] = await knex('tenants').insert([
    {
      name: 'Pesantren Tahfidz Al-Hikmah',
      subdomain: 'alhikmah',
      plan_id: 3, // Premium
      status: 'active',
      subscription_expires_at: oneYearFromNow,
      theme_config: JSON.stringify({
        primaryColor: '#059669',
        institutionName: 'Pesantren Al-Hikmah',
        tagline: 'Mencetak Generasi Qurani Berakhlaq Mulia',
      }),
    },
    {
      name: 'Rumah Tahfidz Darul Quran',
      subdomain: 'darulquran',
      plan_id: 2, // Standard
      status: 'active',
      subscription_expires_at: oneYearFromNow,
      theme_config: JSON.stringify({
        primaryColor: '#2563eb',
        institutionName: 'RTQ Darul Quran',
        tagline: 'Satu Rumah Satu Hafidz',
      }),
    },
  ]);

  // Passwords (default password123 for all demo accounts)
  const defaultPassword = await bcrypt.hash('password123', 10);
  const adminPassword = defaultPassword;
  const guruPassword = defaultPassword;
  const waliPassword = defaultPassword;

  // 3. Users
  const [superAdminId, tenantAdminId, guruId, waliId] = await knex('users').insert([
    {
      tenant_id: null,
      name: 'Super Administrator',
      email: 'superadmin@tahfidz.com',
      phone: '081100000001',
      password_hash: adminPassword,
      role: 'super_admin',
      status: 'active',
    },
    {
      tenant_id: 1,
      name: 'Admin Al-Hikmah',
      email: 'admin@alhikmah.sch.id',
      phone: '081200000002',
      password_hash: adminPassword,
      role: 'admin_tenant',
      status: 'active',
    },
    {
      tenant_id: 1,
      name: 'Ustadz Ahmad Fauzi, S.Pd.I',
      email: 'ustadz.ahmad@alhikmah.sch.id',
      phone: '081300000003',
      password_hash: guruPassword,
      role: 'guru',
      status: 'active',
    },
    {
      tenant_id: 1,
      name: 'Budi Santoso (Wali Fatih)',
      email: 'wali.budi@gmail.com',
      phone: '081400000004',
      password_hash: waliPassword,
      role: 'wali_santri',
      status: 'active',
    },
  ]);

  // 4. Classes
  const [classId] = await knex('classes').insert([
    {
      tenant_id: 1,
      guru_id: 3,
      name: 'Halaqah Utsman bin Affan (Tingkat Mutawassith)',
      academic_year: '2026/2027',
    },
  ]);

  // 5. Santri
  const [santriId] = await knex('santri').insert([
    {
      tenant_id: 1,
      wali_id: 4,
      class_id: 1,
      nisn: '0089123456',
      full_name: 'Muhammad Fatih Robbani',
      gender: 'L',
      total_juz_hafalan: 3.0,
    },
  ]);

  // 6. Hafalan Histories
  await knex('hafalan_histories').insert([
    {
      tenant_id: 1,
      santri_id: 1,
      guru_id: 3,
      type: 'ziyadah',
      juz: 30,
      surah_number: 78,
      surah_name: 'An-Naba',
      verse_start: 1,
      verse_end: 20,
      grade: 'Mumtaz',
      notes: 'Makhraj huruf shad dan tho sangat baik dan jelas.',
      date_recorded: '2026-10-01',
    },
    {
      tenant_id: 1,
      santri_id: 1,
      guru_id: 3,
      type: 'ziyadah',
      juz: 30,
      surah_number: 78,
      surah_name: 'An-Naba',
      verse_start: 21,
      verse_end: 40,
      grade: 'Jayyid Jiddan',
      notes: 'Perhatikan panjang mad wajib muttashil pada ayat 31.',
      date_recorded: '2026-10-03',
    },
    {
      tenant_id: 1,
      santri_id: 1,
      guru_id: 3,
      type: 'tasmi',
      juz: 30,
      surah_number: 78,
      surah_name: 'An-Naba s/d An-Nas (Juz 30 Lengkap)',
      verse_start: 1,
      verse_end: 40,
      grade: 'Mumtaz',
      notes: 'Lulus Ujian Tasmi Sekali Duduk Juz 30 dengan predikat Mumtaz.',
      date_recorded: '2026-10-05',
    },
    {
      tenant_id: 1,
      santri_id: 1,
      guru_id: 3,
      type: 'tasmi',
      juz: 29,
      surah_number: 67,
      surah_name: 'Al-Mulk s/d Al-Mursalat (Juz 29 Lengkap)',
      verse_start: 1,
      verse_end: 50,
      grade: 'Mumtaz',
      notes: 'Lulus Ujian Tasmi Sekali Duduk Juz 29 dengan predikat Mumtaz.',
      date_recorded: '2026-10-06',
    },
    {
      tenant_id: 1,
      santri_id: 1,
      guru_id: 3,
      type: 'tasmi',
      juz: 28,
      surah_number: 58,
      surah_name: 'Al-Mujadilah s/d At-Tahrim (Juz 28 Lengkap)',
      verse_start: 1,
      verse_end: 12,
      grade: 'Mumtaz',
      notes: 'Lulus Ujian Tasmi Sekali Duduk Juz 28 dengan predikat Mumtaz.',
      date_recorded: '2026-10-08',
    },
  ]);

  // 7. Badges
  await knex('badges').insert([
    {
      tenant_id: 1,
      santri_id: 1,
      badge_code: 'JUZ_30',
      badge_name: 'Penakluk Juz 30',
      description: 'Berhasil menyelesaikan hafalan dan tasmi Juz 30.',
      icon_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    },
    {
      tenant_id: 1,
      santri_id: 1,
      badge_code: 'STAR_TAJWID',
      badge_name: 'Bintang Tajwid',
      description: 'Mendapat nilai Mumtaz berturut-turut pada setoran tartil.',
      icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',
    },
  ]);

  // 8. Certificates
  await knex('certificates').insert([
    {
      tenant_id: 1,
      santri_id: 1,
      certificate_no: 'CERT/ALHIKMAH/2026/J30/001',
      juz_completed: 30,
      file_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      issued_date: '2026-10-05',
    },
  ]);

  // 9. LMS Materials
  await knex('lms_materials').insert([
    {
      tenant_id: null,
      title: 'Makharijul Huruf Bagian 1: Al-Halq (Tenggorokan)',
      description: 'Panduan melafalkan huruf Hamzah, Ha, Ain, Ha, Ghain, dan Kha dengan benar.',
      type: 'video',
      content_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      is_global: true,
    },
    {
      tenant_id: 1,
      title: 'Kajian Daring: Menumbuhkan Cinta Al-Quran Pada Anak di Era Digital',
      description: 'Sesi webinar eksklusif wali santri bersama Ustadz Al-Hikmah.',
      type: 'live_meet',
      content_url: 'https://meet.google.com/abc-defg-hij',
      is_global: false,
    },
  ]);

  // 10. Chat Messages
  await knex('chat_messages').insert([
    {
      tenant_id: 1,
      sender_id: 3, // Ustadz Ahmad
      class_id: 1,
      room_type: 'class_group',
      message: 'Assalamu alaikum bapak/ibu wali santri, mohon ananda diingatkan murojaah surat An-Naba malam ini ya.',
    },
    {
      tenant_id: 1,
      sender_id: 4, // Wali Budi
      class_id: 1,
      room_type: 'class_group',
      message: 'Waalaikumsalam ustadz, baik siap, Fatih sedang murojaah setelah sholat maghrib.',
    },
  ]);
};
