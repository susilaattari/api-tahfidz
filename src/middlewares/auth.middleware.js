const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { errorResponse } = require('../utils/response.util');

/**
 * JWT Authentication Middleware
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Akses ditolak. Token autentikasi tidak ditemukan.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'tahfidz_secret_jwt_key_2026_super_secure');
    } catch (err) {
      return errorResponse(res, 'Token tidak valid atau telah kedaluwarsa.', 401);
    }

    const user = await db('users').where({ id: decoded.userId }).first();
    if (!user) {
      return errorResponse(res, 'Pengguna tidak ditemukan dalam sistem.', 401);
    }

    if (user.status === 'inactive') {
      return errorResponse(res, 'Akun Anda dinonaktifkan.', 403);
    }

    // Multi-tenant check: Non-super_admin users must match their own tenant
    if (user.role !== 'super_admin') {
      if (req.tenantId && user.tenant_id !== req.tenantId) {
        return errorResponse(res, 'Akses ditolak: Anda tidak memiliki akses ke institusi ini.', 403);
      }
      // If tenant was not passed in header, attach from user profile
      if (!req.tenantId && user.tenant_id) {
        req.tenantId = user.tenant_id;
      }
    }

    // Remove password_hash and ensure boolean flags on req.user
    delete user.password_hash;
    user.can_create_lms_local = Boolean(user.can_create_lms_local);
    user.can_create_lms_global = Boolean(user.can_create_lms_global);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} roles Allowed roles ('super_admin', 'admin_tenant', 'guru', 'wali_santri')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Autentikasi diperlukan.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, `Akses ditolak: Peran ${req.user.role} tidak memiliki izin untuk tindakan ini.`, 403);
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
