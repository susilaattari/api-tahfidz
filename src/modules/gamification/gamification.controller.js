const gamificationService = require('./gamification.service');
const { successResponse } = require('../../utils/response.util');

class GamificationController {
  async getSantriBadges(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const result = await gamificationService.getBadgesBySantri(tenantId, req.params.santri_id);
      return successResponse(
        res,
        'Daftar lencana prestasi berhasil diambil.',
        result.badges,
        200,
        { santri_name: result.santri_name, total_badges: result.total_badges }
      );
    } catch (error) {
      next(error);
    }
  }


  async awardBadge(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.body.tenant_id : req.user.tenant_id;
      const awarded = await gamificationService.awardBadge(tenantId, req.params.santri_id, req.body);
      return successResponse(res, 'Lencana penghargaan berhasil diberikan kepada santri.', awarded, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GamificationController();
