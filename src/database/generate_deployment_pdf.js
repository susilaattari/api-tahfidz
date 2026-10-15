const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputPath = path.resolve(__dirname, '../../../DOKUMENTASI_DEPLOYMENT_TAHFIDZ_API.pdf');

console.log('Generating Professional Enterprise PDF documentation to:', outputPath);

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 45, left: 45, right: 45 },
  bufferPages: true,
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Corporate / Tech Color Palette
const PRIMARY = '#059669';       // Emerald 600
const PRIMARY_DARK = '#064e3b';  // Emerald 900
const PRIMARY_LIGHT = '#ecfdf5'; // Emerald 50
const SECONDARY = '#0284c7';     // Sky 600
const SLATE_DARK = '#0f172a';    // Slate 900
const SLATE_BODY = '#334155';    // Slate 700
const MUTED = '#64748b';         // Slate 500
const BORDER = '#cbd5e1';        // Slate 300
const BG_LIGHT = '#f8fafc';      // Slate 50
const CODE_BG = '#f1f5f9';       // Slate 100
const AMBER = '#d97706';
const AMBER_LIGHT = '#fffbeb';

// Running Header & Footer Setup
function renderHeader(title) {
  const width = doc.page.width - 90;
  doc.rect(45, 25, width, 22).fill('#f8fafc');
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(45, 47).lineTo(45 + width, 47).stroke();
  doc.fillColor(MUTED).fontSize(7.5).font('Helvetica-Bold')
    .text('STANDAR OPERASIONAL PROSEDUR & DOKUMENTASI DEPLOYMENT PRODUCTION', 52, 32);
  doc.fillColor(PRIMARY).fontSize(7.5).font('Helvetica-Bold')
    .text('QURIVA TECH — SAAS TAHFIDZ', 45, 32, { align: 'right', width: width - 7 });
  doc.y = 58;
}

function renderCoverPage() {
  const width = doc.page.width - 90;
  
  // Decorative Top Accent
  doc.rect(45, 40, width, 12).fill(PRIMARY);
  
  // Title Box
  doc.roundedRect(45, 65, width, 140, 6).fillAndStroke(PRIMARY_LIGHT, PRIMARY);
  
  doc.fillColor(PRIMARY_DARK).fontSize(10).font('Helvetica-Bold')
    .text('BUKU PANDUAN TEKNIS & STANDAR OPERASIONAL PROSEDUR (SOP)', 65, 80);
  
  doc.fillColor(SLATE_DARK).fontSize(20).font('Helvetica-Bold')
    .text('SaaS Tahfidz & Tahsin Quran', 65, 96);
  
  doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold')
    .text('Deployment Architecture, Database Migration & Maintenance Guide', 65, 122);
    
  doc.fillColor(SLATE_BODY).fontSize(9.5).font('Helvetica')
    .text('Panduan resmi instalasi, topologi server VPS Hostinger, reverse proxy Traefik, SSL otomatis, migrasi PostgreSQL, integrasi Next.js Dashboard, serta tata kelola update sistem.', 65, 145, { width: width - 40, lineGap: 3 });

  // Metadata Card
  doc.y = 220;
  const cardY = 220;
  doc.roundedRect(45, cardY, width, 160, 6).fillAndStroke(BG_LIGHT, BORDER);
  
  doc.fillColor(PRIMARY_DARK).fontSize(11).font('Helvetica-Bold')
    .text('INFORMASI DOKUMEN & SPESIFIKASI SISTEM', 60, cardY + 15);
  doc.strokeColor(PRIMARY).lineWidth(1).moveTo(60, cardY + 30).lineTo(60 + width - 30, cardY + 30).stroke();

  const metaRows = [
    { k: 'Identifikasi Sistem', v: 'SaaS Platform Tahfidz & Tahsin Al-Quran Multi-Tenant' },
    { k: 'Target Subdomain Live', v: 'https://api.quriva.tech (API) | https://app.quriva.tech (Dashboard)' },
    { k: 'Infrastruktur Host', v: 'VPS Hostinger — Ubuntu 24.04 LTS (IP: 201.18.218.170)' },
    { k: 'Basis Data Utama', v: 'PostgreSQL 18 (Local Instance: 127.0.0.1:5432 / DB: tahfidz_saas)' },
    { k: 'Reverse Proxy & TLS', v: 'Traefik v3 (Docker Host Mode) + Let\'s Encrypt Auto-Renewal' },
    { k: 'Process Manager', v: 'PM2 Daemon Manager (Node.js & Next.js Runtime)' },
    { k: 'Status Operasional', v: 'PRODUCTION READY (Verified Active)' },
    { k: 'Versi & Tanggal Rilis', v: 'Versi 1.0.0 — 10 Oktober 2026' },
  ];

  let curY = cardY + 38;
  for (const r of metaRows) {
    doc.fillColor(MUTED).fontSize(8.5).font('Helvetica-Bold').text(r.k, 60, curY);
    doc.fillColor(SLATE_DARK).fontSize(8.5).font('Helvetica').text(': ' + r.v, 190, curY);
    curY += 14;
  }

  // Summary Highlights Box
  const summaryY = 400;
  doc.roundedRect(45, summaryY, width, 240, 6).fillAndStroke('#ffffff', BORDER);
  doc.fillColor(PRIMARY_DARK).fontSize(11).font('Helvetica-Bold')
    .text('RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)', 60, summaryY + 15);
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(60, summaryY + 30).lineTo(60 + width - 30, summaryY + 30).stroke();

  doc.fillColor(SLATE_BODY).fontSize(9).font('Helvetica').text(
    'Dokumen ini merangkum seluruh langkah teknis yang telah diselesaikan dalam membawa sistem SaaS Tahfidz ke lingkungan production yang aman dan andal:\n\n' +
    '1. Migrasi Database PostgreSQL: Menggantikan SQLite lokal dengan PostgreSQL 18 untuk mendukung skalabilitas multi-tenant, keamanan konkurensi data, dan kepatuhan foreign key.\n\n' +
    '2. Arsitektur Jaringan Hostinger: Subdomain api.quriva.tech berhasil dihubungkan ke IP 201.18.218.170 melalui DNS Hostinger.\n\n' +
    '3. Integrasi Reverse Proxy Traefik: Memanfaatkan container Traefik bawaan Hostinger (network_mode: host) untuk merutekan port internal 8099 dan 3000 secara dinamis dengan SSL otomatis Let\'s Encrypt.\n\n' +
    '4. Manajemen PM2: Menjamin service backend dan frontend berjalan 24/7 dan otomatis aktif kembali jika server reboot.\n\n' +
    '5. SOP Pembaruan Berkelanjutan: Panduan langkah demi langkah saat pengembang melakukan pembaruan kode di masa mendatang.',
    60, summaryY + 40, { width: width - 30, lineGap: 3, align: 'justify' }
  );

  // Footer Disclaimer
  doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
    .text('Dokumen ini bersifat rahasia internal tim pengembang Quriva Tech. Dilarang menyebarluaskan tanpa izin tertulis.', 45, 755, { align: 'center', width: width });
}

function sectionHeader(no, title) {
  doc.moveDown(0.7);
  const y = doc.y;
  const width = doc.page.width - 90;
  doc.roundedRect(45, y, width, 22, 3).fill(PRIMARY_LIGHT);
  doc.circle(58, y + 11, 7).fill(PRIMARY);
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(String(no), 55, y + 7.5);
  doc.fillColor(PRIMARY_DARK).fontSize(11).font('Helvetica-Bold').text(title, 72, y + 5.5);
  doc.y = y + 28;
}

function subHeader(title) {
  doc.moveDown(0.4);
  doc.fillColor(SLATE_DARK).fontSize(9.5).font('Helvetica-Bold').text(title, 48);
  doc.moveDown(0.2);
}

function bodyText(text) {
  doc.fillColor(SLATE_BODY).fontSize(8.5).font('Helvetica').text(text, 48, doc.y, {
    lineGap: 2.5,
    align: 'justify',
    width: doc.page.width - 96,
  });
  doc.moveDown(0.3);
}

function bulletItem(title, text) {
  const y = doc.y;
  doc.circle(53, y + 4, 2).fill(PRIMARY);
  doc.fillColor(SLATE_DARK).fontSize(8.5).font('Helvetica-Bold').text(title + ' ', 60, y, { continued: true });
  doc.fillColor(SLATE_BODY).font('Helvetica').text(text, {
    lineGap: 2,
    width: doc.page.width - 108,
  });
  doc.moveDown(0.2);
}

function codeSnippet(code) {
  doc.moveDown(0.2);
  const width = doc.page.width - 96;
  const lines = code.split('\n');
  const height = lines.length * 11 + 10;

  if (doc.y + height > doc.page.height - 45) {
    doc.addPage();
    renderHeader();
  }

  const startY = doc.y;
  doc.roundedRect(48, startY, width, height, 3).fillAndStroke(CODE_BG, BORDER);
  doc.fillColor('#0f172a').font('Courier').fontSize(8);
  doc.text(code, 55, startY + 5, {
    width: width - 14,
    lineGap: 2,
  });
  doc.y = startY + height + 5;
}

function callout(type, title, message) {
  doc.moveDown(0.3);
  const width = doc.page.width - 96;
  const isWarn = type === 'WARN';
  const bgColor = isWarn ? AMBER_LIGHT : PRIMARY_LIGHT;
  const borderColor = isWarn ? AMBER : PRIMARY;
  
  const startY = doc.y;
  doc.roundedRect(48, startY, width, 45, 3).fillAndStroke(bgColor, BORDER);
  doc.rect(48, startY, 4, 45).fill(borderColor);
  
  doc.fillColor(borderColor).fontSize(8.5).font('Helvetica-Bold').text(title, 58, startY + 6);
  doc.fillColor(SLATE_BODY).fontSize(8).font('Helvetica').text(message, 58, startY + 19, {
    width: width - 20,
    lineGap: 2,
  });
  doc.y = startY + 50;
}

function tableGrid(headers, rows, widths) {
  doc.moveDown(0.3);
  const width = doc.page.width - 96;
  const rowHeight = 16;
  let curY = doc.y;

  // Header row
  doc.roundedRect(48, curY, width, rowHeight, 2).fill(PRIMARY_DARK);
  let curX = 54;
  for (let i = 0; i < headers.length; i++) {
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text(headers[i], curX, curY + 4, { width: widths[i] });
    curX += widths[i];
  }
  curY += rowHeight;

  // Body rows
  for (let r = 0; r < rows.length; r++) {
    const isEven = r % 2 === 0;
    doc.rect(48, curY, width, rowHeight).fill(isEven ? BG_LIGHT : '#ffffff');
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(48, curY + rowHeight).lineTo(48 + width, curY + rowHeight).stroke();
    
    curX = 54;
    for (let c = 0; c < rows[r].length; c++) {
      doc.fillColor(c === 0 ? SLATE_DARK : SLATE_BODY)
        .fontSize(7.5)
        .font(c === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .text(rows[r][c], curX, curY + 4, { width: widths[c] });
      curX += widths[c];
    }
    curY += rowHeight;
  }
  doc.y = curY + 6;
}

// ================= PAGE 1: COVER =================
renderCoverPage();

// ================= PAGE 2: BAB 1 & BAB 2 =================
doc.addPage();
renderHeader();

sectionHeader(1, 'Topologi Infrastruktur & Arsitektur Jaringan');
bodyText(
  'Arsitektur production dirancang menggunakan pola Reverse Proxy terisolasi. Seluruh traffic HTTPS dari internet masuk melalui Traefik pada port 443, didekripsi dengan sertifikat Let\'s Encrypt, lalu diteruskan ke service lokal yang sesuai (API di port 8099 atau Dashboard di port 3000).'
);

tableGrid(
  ['Komponen Server', 'Teknologi', 'Port', 'Akses Publik / DNS', 'Status'],
  [
    ['Reverse Proxy', 'Traefik v3 (Docker Host)', '80 / 443', 'https://*.quriva.tech', 'ONLINE (SSL Aktif)'],
    ['Backend REST API', 'Node.js Express + Knex', '8099', 'https://api.quriva.tech', 'ONLINE (PM2)'],
    ['Web Dashboard', 'Next.js 14 + Tailwind', '3000', 'https://app.quriva.tech', 'READY TO DEPLOY'],
    ['Database Server', 'PostgreSQL 18', '5432', 'Internal (127.0.0.1 only)', 'ONLINE (Seeded)'],
    ['Static Uploads', 'Local Storage / Express', '8099', 'https://api.quriva.tech/uploads', 'ACCESSIBLE'],
  ],
  [100, 115, 55, 140, 95]
);

sectionHeader(2, 'Migrasi Database PostgreSQL & Normalisasi Query');
bodyText(
  'Database telah dimigrasikan dari SQLite ke PostgreSQL 18. Karena PostgreSQL memiliki perbedaan penanganan ID autoincrement dibandingkan SQLite/MySQL, kami mengimplementasikan adapter normalisasi otomatis di tingkat Knex.'
);

subHeader('2.1. Normalisasi Query Insert (knexfile.js)');
bodyText(
  'Pada PostgreSQL standar, perintah insert tanpa returning("id") tidak menghasilkan ID baris baru. Modifikasi berikut dipasang di knexfile.js agar const [id] = await db("table").insert(...) berjalan seragam tanpa mengubah kode controller:'
);
codeSnippet(
`const originalInsert = QueryBuilder.prototype.insert;
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
};`
);

subHeader('2.2. Otomatisasi Setup & Verifikasi Database');
bulletItem('npm run db:setup :', 'Menghubungkan ke PostgreSQL, membuat database tahfidz_saas jika belum ada, menjalankan 3 batch migrasi tabel, dan menyuntikkan data seed.');
bulletItem('npm run db:check :', 'Menampilkan laporan instan status 15 tabel, jumlah baris data, dan sampel akun.');

// ================= PAGE 3: BAB 3 & BAB 4 =================
doc.addPage();
renderHeader();

sectionHeader(3, 'Konfigurasi DNS Subdomain (Hostinger)');
bodyText(
  'Pengaturan DNS dilakukan melalui portal Hostinger DNS Management untuk domain quriva.tech. Record Type A memastikan traffic subdomain terarah langsung ke IP Publik VPS.'
);

tableGrid(
  ['Subdomain', 'Type', 'Host Record', 'Target IPv4 VPS', 'TTL', 'Fungsi'],
  [
    ['api.quriva.tech', 'A', 'api', '201.18.218.170', '3600', 'Backend REST API & WebSocket'],
    ['app.quriva.tech', 'A', 'app', '201.18.218.170', '3600', 'Web Admin Dashboard Next.js'],
  ],
  [95, 35, 60, 95, 45, 175]
);

sectionHeader(4, 'Implementasi Reverse Proxy Traefik & Auto SSL Let\'s Encrypt');
bodyText(
  'Traefik v3 berjalan pada mode host network di server VPS Hostinger. Untuk menambahkan rute baru tanpa menyentuh container Traefik, Traefik dikonfigurasi menggunakan File Provider dinamis.'
);

subHeader('4.1. File Rute API Dinamis (/docker/traefik/dynamic/api-tahfidz.yml)');
codeSnippet(
`http:
  routers:
    tahfidz-api:
      rule: "Host(\`api.quriva.tech\`)"
      entryPoints:
        - "websecure"
      service: "tahfidz-api-service"
      tls:
        certResolver: "letsencrypt"

  services:
    tahfidz-api-service:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8099"`
);

subHeader('4.2. Konfigurasi Compose Traefik (/docker/traefik/docker-compose.yml)');
bodyText(
  'Perintah command ditambahkan parameter --providers.file.directory=/etc/traefik/dynamic dan --providers.file.watch=true serta mount volume /docker/traefik/dynamic:/etc/traefik/dynamic. Traefik otomatis mendeteksi perubahan konfigurasi dalam hitungan detik tanpa perlu restart container.'
);

callout(
  'INFO',
  'KEAMANAN SSL OTOMATIS LET\'S ENCRYPT',
  'Traefik secara mandiri menangani tantangan ACME HTTP Challenge, penerbitan sertifikat SSL, dan perpanjangan (renewal) otomatis setiap 90 hari tanpa memerlukan cron job certbot eksternal.'
);

// ================= PAGE 4: BAB 5, 6, 7 =================
doc.addPage();
renderHeader();

sectionHeader(5, 'Manajemen Background Daemon Menggunakan PM2');
bodyText(
  'PM2 digunakan untuk memastikan Node.js dan Next.js berjalan tanpa henti di background, serta otomatis aktif kembali saat VPS mengalami reboot.'
);
codeSnippet(
`# Direktori kerja API:
cd /root/home/api-tahfidz

# Menjalankan service dengan PM2:
pm2 start src/server.js --name "tahfidz-api"
pm2 save
pm2 startup`
);

sectionHeader(6, 'Katalog Endpoint API & Kredensial Akun Bawaan');
tableGrid(
  ['Modul / Fitur', 'Metode & Endpoint', 'Autentikasi', 'Deskripsi'],
  [
    ['Health Check', 'GET /api/health', 'Publik', 'Status operasional API & context tenant'],
    ['Login Akun', 'POST /api/auth/login', 'Publik', 'Menerbitkan JWT Token (7 hari)'],
    ['Santri', 'GET, POST /api/santri', 'Bearer JWT', 'Manajemen santri & capaian juz'],
    ['Hafalan', 'GET, POST /api/hafalan', 'Bearer JWT', 'Setoran Ziyadah, Tasmi, Murojaah'],
    ['Tahsin Audio', 'GET, POST /api/tahsin', 'Bearer JWT', 'Upload audio rekaman & feedback guru'],
    ['Absensi', 'GET, POST /api/attendance', 'Bearer JWT', 'Absensi halaqah harian santri'],
    ['Jadwal', 'GET, POST /api/schedules', 'Bearer JWT', 'Jadwal halaqah & kegiatan tahfidz'],
  ],
  [85, 125, 75, 220]
);

subHeader('6.1. Akun Demo Bawaan Database');
bulletItem('Super Admin :', 'superadmin@tahfidz.com (Password: password123)');
bulletItem('Admin Pesantren Al-Hikmah :', 'admin@alhikmah.sch.id (Password: password123)');
bulletItem('Guru / Ustadz :', 'ustadz.ahmad@alhikmah.sch.id (Password: password123)');
bulletItem('Wali Santri :', 'wali.budi@gmail.com (Password: password123)');

sectionHeader(7, 'Integrasi Client Dashboard & Mobile App');
bulletItem('Dashboard Web (.env.production) :', 'NEXT_PUBLIC_API_URL=https://api.quriva.tech/api');
bulletItem('Mobile App Expo (src/config/api.js) :', 'API_BASE_URL=https://api.quriva.tech/api');

// ================= PAGE 5: BAB 8 & BAB 9 (SOP UPDATE) =================
doc.addPage();
renderHeader();

sectionHeader(8, 'Panduan Deployment Web Dashboard (Next.js 14)');
bodyText(
  'Aplikasi Web Dashboard Next.js 14 (saas-tahfidz-dashboard) dideploy berdampingan dengan API di server yang sama menggunakan port 3000.'
);

subHeader('8.1. Tambah Rute Traefik Dashboard (/docker/traefik/dynamic/dashboard-tahfidz.yml)');
codeSnippet(
`cat << 'EOF' > /docker/traefik/dynamic/dashboard-tahfidz.yml
http:
  routers:
    tahfidz-dashboard:
      rule: "Host(\`app.quriva.tech\`)"
      entryPoints:
        - "websecure"
      service: "tahfidz-dashboard-service"
      tls:
        certResolver: "letsencrypt"

  services:
    tahfidz-dashboard-service:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"
EOF`
);

subHeader('8.2. Langkah Build & Start PM2 Dashboard di VPS');
codeSnippet(
`cd /root/home/saas-tahfidz-dashboard
echo "NEXT_PUBLIC_API_URL=https://api.quriva.tech/api" > .env.production
npm install
npm run build
pm2 start npm --name "tahfidz-dashboard" -- start -- -p 3000
pm2 save`
);

sectionHeader(9, 'SOP Pembaruan Kode (Continuous Update Workflow)');
bodyText(
  'Setiap kali Anda selesai memperbarui kode di komputer lokal dan melakukan git push origin main, jalankan prosedur rilis berikut di terminal VPS:'
);

subHeader('9.1. Alur Rilis Update API:');
codeSnippet(
`cd /root/home/api-tahfidz
git pull origin main
npm install              # (Jalankan bila ada package baru)
npm run migrate:latest   # (Jalankan bila ada migrasi database baru)
pm2 restart tahfidz-api
pm2 logs tahfidz-api --lines 30`
);

subHeader('9.2. Alur Rilis Update Web Dashboard:');
codeSnippet(
`cd /root/home/saas-tahfidz-dashboard
git pull origin main
npm install              # (Jalankan bila ada package baru)
npm run build            # WAJIB kompilasi bundle Next.js produksi
pm2 restart tahfidz-dashboard
pm2 status`
);

// ================= PAGE 6: BAB 10 & SIGN-OFF =================
doc.addPage();
renderHeader();

sectionHeader(10, 'Tata Kelola Keamanan, Backup & Prosedur Rollback');

subHeader('10.1. Kebijakan Keamanan Database');
bulletItem('Proteksi Loopback :', 'PostgreSQL hanya dibuka pada 127.0.0.1, mencegah akses langsung dari internet luar.');
bulletItem('Isolasi File Rahasia :', 'File .env tidak pernah disimpan ke repositori Git (terlindungi oleh .gitignore).');
bulletItem('JWT Authentication :', 'Token JWT menggunakan algoritma HMAC-SHA256 dengan masa berlaku 7 hari.');

subHeader('10.2. Prosedur Backup Database Rutin');
bodyText('Sebelum melakukan perubahan besar atau migrasi skema baru, buat backup database:');
codeSnippet(
`# Backup cepat seluruh database PostgreSQL:
pg_dump -U postgres -d tahfidz_saas > /root/backup_tahfidz_\$(date +%F_%H%M).sql

# Restore cadangan jika diperlukan:
psql -U postgres -d tahfidz_saas < /root/backup_tahfidz_tanggal.sql`
);

subHeader('10.3. Prosedur Rollback Cepat');
bodyText(
  'Jika update terbaru mengalami kendala dan perlu segera dikembalikan ke versi stabil sebelumnya: jalankan git checkout HEAD~1, untuk dashboard jalankan npm run build, lalu restart PM2.'
);

doc.moveDown(1.5);
const width = doc.page.width - 90;
const signY = doc.y;

doc.roundedRect(45, signY, width, 110, 4).fillAndStroke(BG_LIGHT, BORDER);
doc.fillColor(PRIMARY_DARK).fontSize(9.5).font('Helvetica-Bold')
  .text('LEMBAR PENGESAHAN DOKUMEN TEKNIS (SIGN-OFF)', 60, signY + 12);
doc.strokeColor(BORDER).lineWidth(0.5).moveTo(60, signY + 26).lineTo(60 + width - 30, signY + 26).stroke();

doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text('DISIAPKAN OLEH:', 60, signY + 34);
doc.fillColor(SLATE_DARK).fontSize(8.5).font('Helvetica').text('Antigravity AI Agent & Engineering Team', 60, signY + 46);
doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Peran: Lead Software Architect', 60, signY + 58);
doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('Status: Verified & Deployed', 60, signY + 70);

doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text('DISETUJUI OLEH:', 310, signY + 34);
doc.fillColor(SLATE_DARK).fontSize(8.5).font('Helvetica').text('Susila Tropika', 310, signY + 46);
doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Peran: Product Owner & System Owner', 310, signY + 58);
doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('Domain: quriva.tech', 310, signY + 70);

// Global Running Page Numbers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  if (i > 0) { // Don't show footer on cover
    doc.fillColor(MUTED).fontSize(7.5).font('Helvetica').text(
      `Dokumentasi Teknis SaaS Tahfidz — Quriva Tech | Halaman ${i + 1} dari ${range.count}`,
      45,
      doc.page.height - 30,
      { align: 'center', width: doc.page.width - 90 }
    );
  }
}

doc.end();

writeStream.on('finish', () => {
  console.log('Professional Enterprise PDF generated successfully at:', outputPath);
});
