const db = require('../config/database');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware to extract and validate Tenant.
 * Checks header 'X-Tenant-ID', query parameter 'tenant_id', or subdomain.
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantIdentifier = req.headers['x-tenant-id'] || req.query.tenant_id;

    // Subdomain extraction fallback (if running under e.g. pondok-a.tahfidz.com)
    if (!tenantIdentifier && req.headers.host) {
      const hostParts = req.headers.host.split('.');
      if (hostParts.length > 2 && hostParts[0] !== 'api' && hostParts[0] !== 'www') {
        tenantIdentifier = hostParts[0];
      }
    }

    if (tenantIdentifier) {
      let tenant;
      // Search by ID or subdomain
      if (!isNaN(tenantIdentifier)) {
        tenant = await db('tenants').where({ id: Number(tenantIdentifier) }).first();
      } else {
        tenant = await db('tenants').where({ subdomain: tenantIdentifier }).first();
      }

      if (tenant) {
        if (tenant.status === 'suspended') {
          return errorResponse(res, 'Akun institusi/tenant ini sedang ditangguhkan. Hubungi Super Admin.', 403);
        }
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Strict tenant requirement middleware
 */
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return errorResponse(res, 'Header X-Tenant-ID atau subdomain institusi diperlukan untuk mengakses sumber daya ini.', 400);
  }
  next();
};

module.exports = {
  tenantMiddleware,
  requireTenant,
};
