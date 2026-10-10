const PDFDocument = require('pdfkit');
const db = require('../../config/database');
const { uploadFile } = require('../../config/storage');

class CertificatesService {
  async getCertificatesBySantri(tenantId, santriId) {
    const list = await db('certificates')
      .where({ tenant_id: tenantId, santri_id: santriId })
      .orderBy('issued_date', 'desc');

    return list;
  }

  async getCertificateById(id, tenantId) {
    const cert = await db('certificates')
      .leftJoin('santri', 'certificates.santri_id', 'santri.id')
      .leftJoin('tenants', 'certificates.tenant_id', 'tenants.id')
      .where({ 'certificates.id': id, 'certificates.tenant_id': tenantId })
      .select('certificates.*', 'santri.full_name as santri_name', 'tenants.name as tenant_name')
      .first();

    if (!cert) {
      const err = new Error('Sertifikat tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    return cert;
  }

  async generatePdfBuffer(tenantName, santriName, juz, certNo, dateStr) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 40,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Certificate Border
      doc.rect(20, 20, 782, 555).lineWidth(4).strokeColor('#059669').stroke();
      doc.rect(26, 26, 770, 543).lineWidth(1.5).strokeColor('#d1fae5').stroke();

      // Header
      doc.moveDown(1.5);
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#065f46').text('SERTIFIKAT KELULUSAN TASMI\'', { align: 'center' });
      doc.fontSize(12).font('Helvetica').fillColor('#047857').text(tenantName.toUpperCase(), { align: 'center' });
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b').text(`Nomor: ${certNo}`, { align: 'center' });

      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica').fillColor('#334155').text('Diberikan dengan penuh rasa syukur dan bangga kepada:', { align: 'center' });

      // Santri Name
      doc.moveDown(0.8);
      doc.fontSize(26).font('Helvetica-Bold').fillColor('#0f172a').text(santriName, { align: 'center', underline: true });

      // Body Statement
      doc.moveDown(0.8);
      doc.fontSize(14).font('Helvetica').fillColor('#334155').text(
        `Atas keberhasilan menyelesaikan hafalan dan lulus Ujian Tasmi' Sekali Duduk\nJUZ ${juz} AL-QUR'AN AL-KARIM`,
        { align: 'center', lineGap: 4 }
      );

      // Signatures & Date
      doc.moveDown(3);
      const y = doc.y;

      // Left: Tanggal
      doc.fontSize(11).font('Helvetica').fillColor('#475569')
        .text(`Diterbitkan pada: ${dateStr}`, 100, y);

      // Right: Dewan Penguji
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Pimpinan & Dewan Asatidz', 550, y, { align: 'center' });
      doc.moveDown(3);
      doc.fontSize(11).font('Helvetica').fillColor('#475569')
        .text('( ______________________ )', 550, doc.y, { align: 'center' });

      doc.end();
    });
  }

  async issueCertificate(tenantId, santriId, juzCompleted) {
    const santri = await db('santri').where({ id: santriId, tenant_id: tenantId }).first();
    const tenant = await db('tenants').where({ id: tenantId }).first();

    if (!santri || !tenant) {
      const err = new Error('Santri atau Tenant tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const certNo = `CERT/${tenant.subdomain.toUpperCase()}/${year}/J${juzCompleted}/${randomSuffix}`;
    const today = new Date().toISOString().split('T')[0];

    // Generate PDF Buffer
    const pdfBuffer = await this.generatePdfBuffer(tenant.name, santri.full_name, juzCompleted, certNo, today);

    // Upload PDF
    const filename = `certificates/${tenant.subdomain}_santri_${santriId}_juz${juzCompleted}_${Date.now()}.pdf`;
    const fileUrl = await uploadFile(filename, pdfBuffer, 'application/pdf');

    const [id] = await db('certificates').insert({
      tenant_id: tenantId,
      santri_id: santriId,
      certificate_no: certNo,
      juz_completed: Number(juzCompleted),
      file_url: fileUrl,
      issued_date: today,
    });

    return db('certificates').where({ id }).first();
  }
}

module.exports = new CertificatesService();
