const db = require('../config/database');
const { errorResponse } = require('../utils/response.util');

/**
 * Middleware to enforce subscription package feature gating.
 * Super Admin bypasses all checks.
 * Tenant users are checked against their assigned package's features.
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      // Super admin has full access to all features globally
      if (req.user?.role === 'super_admin') {
        return next();
      }

      const tenantId = req.user?.tenant_id || req.tenantId;
      if (!tenantId) {
        return errorResponse(res, 'Konteks institusi/tenant tidak ditemukan.', 400);
      }

      const tenant = await db('tenants')
        .leftJoin('packages', 'tenants.plan_id', 'packages.id')
        .where('tenants.id', tenantId)
        .select('packages.features', 'packages.name as plan_name')
        .first();

      let features = {};
      if (tenant?.features) {
        features = typeof tenant.features === 'string' ? JSON.parse(tenant.features || '{}') : tenant.features;
      }

      if (!features[featureName]) {
        return errorResponse(
          res,
          `Fitur '${featureName}' tidak termasuk dalam ${tenant?.plan_name || 'paket langganan Anda'}. Silakan upgrade paket langganan untuk mengakses fitur ini.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  requireFeature,
};
