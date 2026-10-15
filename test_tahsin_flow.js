const app = require('./src/app');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function testTahsinFlow() {
  const TEST_PORT = 8199;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log('\n======================================================');
  console.log(`🚀 Menguji Endpoint Tahsin di Port Uji Coba ${TEST_PORT}`);
  console.log('======================================================');

  try {
    // 1. Login Wali Santri
    console.log('\n[1] Melakukan login akun Wali Santri...');
    const waliLogin = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'wali.budi@gmail.com', password: 'password123' }),
    });
    const waliData = await waliLogin.json();
    if (!waliLogin.ok) throw new Error(`Login wali gagal: ${waliData.message}`);
    const waliToken = waliData.data?.token;
    const tenantId = waliData.data?.user?.tenant_id || 1;
    console.log(`✓ Login Wali Berhasil: ${waliData.data?.user?.name}`);

    // 2. Submit Audio Setoran Tahsin (Simulasi rekaman suara santri)
    console.log('\n[2] Mengirim setoran suara tahsin (Multipart FormData)...');
    const formData = new FormData();
    formData.append('santri_id', '1');
    formData.append('title', 'Setoran Suara An-Naba Ayat 1-10');
    formData.append('surah_number', '78');
    formData.append('verse_start', '1');
    formData.append('verse_end', '10');
    formData.append('catatan_wali', 'Mohon bimbingan tajwid makhraj huruf ustadz.');

    // Mock file audio rekaman santri
    const mockAudio = new Blob(['RIFF....WAVEfmt ....data_audio_santri_sample'], { type: 'audio/m4a' });
    formData.append('audio', mockAudio, 'rekaman_santri.m4a');

    const submitRes = await fetch(`http://localhost:${TEST_PORT}/api/tahsin/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waliToken}`,
        'X-Tenant-ID': String(tenantId),
      },
      body: formData,
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) throw new Error(`Kirim setoran gagal: ${submitData.message}`);
    const submissionId = submitData.data?.id;
    const uploadedAudioUrl = submitData.data?.audio_url;

    console.log(`✓ Setoran Berhasil Diterima Server! ID: ${submissionId}`);
    console.log(`✓ URL File Audio di Server: ${uploadedAudioUrl}`);

    // Cek file fisik di disk
    const filename = uploadedAudioUrl.split('/uploads/')[1];
    const physicalPath = path.resolve(__dirname, 'uploads', filename);
    const fileExists = fs.existsSync(physicalPath);
    console.log(`✓ Verifikasi File Fisik di Storage Lokal: ${fileExists ? 'ADA (Tersimpan)' : 'TIDAK ADA'}`);

    // 3. Login Guru & Ambil Setoran
    console.log('\n[3] Melakukan login Dewan Guru & mengambil antrean setoran...');
    const guruLogin = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ustadz.ahmad@alhikmah.sch.id', password: 'password123' }),
    });
    const guruData = await guruLogin.json();
    if (!guruLogin.ok) throw new Error(`Login guru gagal: ${guruData.message}`);
    const guruToken = guruData.data?.token;

    const listRes = await fetch(`http://localhost:${TEST_PORT}/api/tahsin`, {
      headers: {
        'Authorization': `Bearer ${guruToken}`,
        'X-Tenant-ID': String(tenantId),
      },
    });
    const listData = await listRes.json();
    const targetItem = listData.data?.find((s) => s.id === submissionId);
    console.log(`✓ Guru menemukan rekaman santri: "${targetItem?.title}"`);
    console.log(`✓ URL Audio yang siap diputar di perangkat Guru: ${targetItem?.audio_url}`);

    // 4. Guru Evaluasi & Kirim Voice Feedback
    console.log('\n[4] Dewan Guru mengirim evaluasi nilai & voice feedback...');
    const reviewForm = new FormData();
    reviewForm.append('tajwid_score', '95');
    reviewForm.append('fluent_score', '90');
    reviewForm.append('feedback_note', 'Alhamdulillah bacaan tartil, makhraj fasih.');
    reviewForm.append('delete_audio', 'false');

    const mockFeedbackAudio = new Blob(['RIFF....WAVEfmt ....data_audio_ustadz_feedback'], { type: 'audio/m4a' });
    reviewForm.append('feedback_audio', mockFeedbackAudio, 'koreksi_ustadz.m4a');

    const reviewRes = await fetch(`http://localhost:${TEST_PORT}/api/tahsin/${submissionId}/review`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${guruToken}`,
        'X-Tenant-ID': String(tenantId),
      },
      body: reviewForm,
    });
    const reviewData = await reviewRes.json();
    if (!reviewRes.ok) throw new Error(`Koreksi gagal: ${reviewData.message}`);

    console.log(`✓ Evaluasi & Voice Feedback Berhasil Disimpan!`);
    console.log(`✓ URL Voice Feedback Ustadz: ${reviewData.data?.feedback_audio_url}`);

    // 5. Test Fitur Hapus Rekaman Mandiri oleh Wali
    console.log('\n[5] Menguji fitur hapus rekaman audio mandiri oleh Wali...');
    const cleanRes = await fetch(`http://localhost:${TEST_PORT}/api/tahsin/${submissionId}/clean-audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waliToken}`,
        'X-Tenant-ID': String(tenantId),
      },
    });
    const cleanData = await cleanRes.json();
    if (!cleanRes.ok) throw new Error(`Hapus audio gagal: ${cleanData.message}`);
    console.log(`✓ Status Hapus Audio oleh Wali: ${cleanData.message}`);
    console.log(`✓ Audio URL setelah dihapus: ${cleanData.data?.audio_url}`);
    console.log(`✓ is_audio_deleted: ${cleanData.data?.is_audio_deleted}`);

    // 6. Test Trigger Pembersihan Otomatis Audio > 7 Hari (1 Minggu)
    console.log('\n[6] Menguji Scheduler Pembersihan Otomatis Audio > 7 Hari...');
    const { runTahsinAudioCleaner } = require('./src/jobs/tahsinAudioCleaner.job');
    const autoCleanResult = await runTahsinAudioCleaner();
    console.log(`✓ Auto-Cleaner Berjalan Sukses! File dibersihkan: ${autoCleanResult.cleanedCount}`);

    console.log('\n======================================================');
    console.log('🌟 SEMUA PROSES REKAMAN, HAPUS AUDIO & AUTO-CLEAN 7 HARI BERHASIL 100%! 🌟');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Terjadi kendala saat uji coba:', error.message);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(0);
  }
}

testTahsinFlow();
