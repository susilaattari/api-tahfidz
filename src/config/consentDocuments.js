const CONSENT_VERSION = '2026-10-21';

const CONSENT_DOCUMENTS = {
  privacy_policy: {
    consent_type: 'privacy_policy',
    version: CONSENT_VERSION,
    title: 'Kebijakan Privasi & Penggunaan Data',
    summary:
      'Persetujuan penggunaan data untuk menjalankan layanan mutabaah hafalan, tahsin, absensi, dan komunikasi antara lembaga, guru, serta wali santri.',
    sections: [
      {
        heading: 'Data yang dikumpulkan',
        body:
          'Kami dapat menyimpan nama, email, nomor WhatsApp, peran pengguna, data lembaga, data santri, catatan hafalan, absensi, riwayat setoran, serta rekaman suara tahsin yang dikirim melalui aplikasi.',
      },
      {
        heading: 'Tujuan penggunaan',
        body:
          'Data digunakan untuk menampilkan progres hafalan, memproses penilaian tahsin, mengelola absensi dan jadwal, mengirim pemberitahuan, serta menyediakan laporan kepada lembaga dan wali santri yang berhak.',
      },
      {
        heading: 'Akses dan pembagian data',
        body:
          'Data hanya dapat diakses oleh pengguna yang berhak di dalam lembaga Anda dan tim layanan Quriva yang membutuhkan akses untuk mendukung operasional. Kami tidak menjual data pribadi kepada pihak lain.',
      },
      {
        heading: 'Penyimpanan dan keamanan',
        body:
          'Data disimpan pada infrastruktur yang dikelola dengan kontrol akses, pencatatan aktivitas, dan pembatasan akses berbasis peran. Rekaman suara tahsin dapat dibersihkan setelah proses evaluasi sesuai kebijakan lembaga.',
      },
      {
        heading: 'Hak pengguna',
        body:
          'Anda dapat melihat status persetujuan, meminta koreksi data, atau menarik persetujuan melalui pengaturan aplikasi. Penarikan persetujuan wajib dapat membuat sebagian layanan tidak dapat digunakan.',
      },
      {
        heading: 'Perubahan kebijakan',
        body:
          'Jika isi kebijakan berubah secara material, versi dokumen akan diperbarui dan Anda akan diminta menyetujui kembali sebelum melanjutkan penggunaan aplikasi.',
      },
    ],
  },
  voice_recording: {
    consent_type: 'voice_recording',
    version: CONSENT_VERSION,
    title: 'Persetujuan Rekaman Suara Anak untuk Tahsin',
    summary:
      'Persetujuan agar rekaman suara anak digunakan khusus untuk pembinaan bacaan Al-Qur’an oleh guru atau admin lembaga.',
    sections: [
      {
        heading: 'Tujuan perekaman',
        body:
          'Rekaman suara digunakan untuk menilai kelancaran bacaan, makhraj, tajwid, dan memberikan koreksi tahsin yang sesuai dengan kebutuhan anak.',
      },
      {
        heading: 'Siapa yang dapat mengakses',
        body:
          'Rekaman dapat diakses oleh guru pembimbing, admin lembaga yang berwenang, dan wali santri yang bersangkutan. Akses dibatasi berdasarkan peran dan tenant.',
      },
      {
        heading: 'Penyimpanan dan pembersihan',
        body:
          'Rekaman disimpan seperlunya untuk proses pembinaan. Lembaga dapat menghapus file audio setelah evaluasi selesai; nilai dan catatan evaluasi tetap tersimpan.',
      },
      {
        heading: 'Persetujuan wali',
        body:
          'Dengan menyetujui, Anda selaku wali memberikan izin perekaman dan pembinaan suara anak melalui aplikasi Quriva untuk anak yang terdaftar pada lembaga ini.',
      },
      {
        heading: 'Penarikan persetujuan',
        body:
          'Anda dapat menarik persetujuan melalui halaman Persetujuan & Privasi. Setelah ditarik, fitur setoran suara untuk anak tersebut tidak dapat digunakan sampai persetujuan diberikan kembali.',
      },
    ],
  },
};

module.exports = {
  CONSENT_VERSION,
  CONSENT_DOCUMENTS,
};
