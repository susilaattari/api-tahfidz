const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Terjadi kesalahan pada server';

  // Handle database unique constraint violations (PostgreSQL 23505, SQLite, MySQL 1062)
  if (
    err.code === '23505' ||
    err.code === 'SQLITE_CONSTRAINT' ||
    err.code === 'ER_DUP_ENTRY' ||
    err.message?.includes('unique constraint') ||
    err.message?.includes('UNIQUE constraint')
  ) {
    statusCode = 409;
    if (err.constraint === 'packages_code_unique' || err.message?.includes('packages_code_unique')) {
      message = 'Kode unik paket ini sudah digunakan. Silakan gunakan kode unik yang lain.';
    } else if (err.constraint === 'tenants_subdomain_unique' || err.message?.includes('tenants_subdomain_unique')) {
      message = 'Subdomain ini sudah digunakan. Silakan gunakan subdomain yang lain.';
    } else if (err.constraint === 'users_email_unique' || err.message?.includes('users_email_unique')) {
      message = 'Alamat email ini sudah terdaftar. Silakan gunakan email yang lain.';
    } else if (err.constraint === 'certificates_certificate_no_unique' || err.message?.includes('certificate_no_unique')) {
      message = 'Nomor sertifikat ini sudah terdaftar.';
    } else {
      message = 'Data yang Anda masukkan sudah ada di sistem (duplikat). Silakan periksa kembali.';
    }
  }

  return errorResponse(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
};

module.exports = errorHandler;

