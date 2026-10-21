const nodemailer = require('nodemailer');
const brand = require('../config/brand');
const logger = require('../utils/logger');

const fromName = `${brand.name} Tahfidz`;
const fromAddress = `noreply@${brand.rootDomain}`;

class MailService {
  constructor() {
    this.emailUser = process.env.EMAIL_USER || process.env.SMTP_USER || '';
    this.emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
    this.emailFrom = process.env.EMAIL_FROM || (this.emailUser ? `"${fromName}" <${this.emailUser}>` : `"${fromName}" <${fromAddress}>`);
    this.isConfigured = Boolean(this.emailUser && this.emailPass);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.emailUser,
          pass: this.emailPass,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  getTransporter() {
    // Re-check env vars dynamically in case updated at runtime
    const currentUser = process.env.EMAIL_USER || process.env.SMTP_USER || '';
    const currentPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
    if (currentUser && currentPass) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: currentUser,
          pass: currentPass,
        },
      });
    }
    return null;
  }

  /**
   * Send 6-digit verification OTP email
   */
  async sendOtpEmail(toEmail, otpCode, type = 'registration') {
    const transporter = this.getTransporter();

    const subject = `Kode Verifikasi OTP Anda: ${otpCode} — Quriva Tahfidz`;
    const purposeText = type === 'registration' 
      ? 'pendaftaran akun baru di ekosistem Quriva Tahfidz & Tahsin' 
      : 'verifikasi keamanan akun Quriva Anda';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #0A4F44 0%, #0E6B5C 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">QURIVA</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #D8EEE8; opacity: 0.9;">Platform Ekosistem Tahfidz & Tahsin Modern</p>
        </div>

        <div style="padding: 28px 24px;">
          <h2 style="font-size: 18px; color: #17283F; margin-top: 0; margin-bottom: 8px;">Verifikasi Email Pendaftaran</h2>
          <p style="font-size: 13.5px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
            Assalamu'alaikum Warahmatullahi Wabarakatuh,<br><br>
            Terima kasih telah melakukan ${purposeText}. Gunakan kode OTP 6 digit berikut untuk menyelesaikan proses verifikasi email Anda:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: #EEF3F1; border: 2px dashed #0E6B5C; border-radius: 12px; padding: 14px 28px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #0E6B5C; letter-spacing: 8px;">
                ${otpCode}
              </span>
            </div>
            <p style="font-size: 11.5px; color: #64748b; margin-top: 8px;">
              ⏱️ Kode ini berlaku selama <strong>5 menit</strong>. Jangan berikan kode ini kepada siapa pun.
            </p>
          </div>

          <p style="font-size: 12.5px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Jika Anda tidak merasa mendaftar atau meminta kode ini, abaikan email ini dengan aman.
          </p>
        </div>

        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          © 2026 Quriva Tahfidz. Seluruh hak cipta dilindungi undang-undang.
        </div>
      </div>
    `;

    const plainText = [
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,`,
      ``,
      `Terima kasih telah melakukan pendaftaran di Quriva Tahfidz.`,
      `Berikut adalah kode OTP verifikasi akun Anda:`,
      ``,
      `>>> KODE OTP: ${otpCode} <<<`,
      ``,
      `Kode ini berlaku selama 5 menit. Harap jangan membagikan kode ini kepada siapa pun demi keamanan akun Anda.`,
      ``,
      `Jika Anda tidak merasa mendaftar di ${brand.name} Tahfidz, Anda dapat mengabaikan email ini dengan aman.`,
      ``,
      `Wassalamu'alaikum Warahmatullahi Wabarakatuh,`,
      `Tim ${brand.name} Tahfidz`,
      `https://${brand.rootDomain}`
    ].join('\n');

    // If SMTP is configured, attempt real email delivery
    if (transporter) {
      try {
        const fromHeader = process.env.EMAIL_USER
          ? `"${fromName}" <${process.env.EMAIL_USER}>`
          : `"${fromName}" <${fromAddress}>`;

        const info = await transporter.sendMail({
          from: fromHeader,
          to: toEmail,
          subject,
          text: plainText,
          html: htmlContent,
          headers: {
            'X-Priority': '1 (Highest)',
            'X-MSMail-Priority': 'High',
            'Importance': 'High',
            'X-Mailer': 'Quriva Tahfidz System',
          },
        });

        logger.info(`[MAIL] OTP email sent successfully to ${toEmail}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId, simulated: false };
      } catch (err) {
        logger.error(`[MAIL ERROR] Failed to send email via SMTP to ${toEmail}: ${err.message}`);
        // Fallback to simulated log so workflow doesn't fail
        logger.info(`=======================================================`);
        logger.info(`🔑 [SIMULATED OTP FALLBACK] TO: ${toEmail} | CODE: ${otpCode}`);
        logger.info(`=======================================================`);
        return { success: true, simulated: true, otp: otpCode, error: err.message };
      }
    } else {
      // Development mode / unconfigured SMTP: Log clearly to console
      logger.info(`=======================================================`);
      logger.info(`🔑 [EMAIL OTP SIMULATION]`);
      logger.info(`📧 Target Email : ${toEmail}`);
      logger.info(`🔢 OTP Code     : ${otpCode}`);
      logger.info(`💡 Info         : Masukkan EMAIL_USER & EMAIL_PASS (App Password) di .env untuk kirim nyata.`);
      logger.info(`=======================================================`);
      return { success: true, simulated: true, otp: otpCode };
    }
  }
}

module.exports = new MailService();
