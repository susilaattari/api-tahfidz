const attendanceService = require('./attendance.service');
const { successResponse } = require('../../utils/response.util');

class AttendanceController {
  /**
   * Catat absensi halaqah
   */
  async record(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.body.tenant_id || req.tenantId) : req.user.tenant_id;
      const guruId = req.user.id;
      const result = await attendanceService.recordAttendance(tenantId, guruId, req.body);
      return successResponse(res, 'Absensi halaqah berhasil disimpan.', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ambil absensi berdasarkan kelas & tanggal
   */
  async getByClassAndDate(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const { class_id, date } = req.query;
      const result = await attendanceService.getByClassAndDate(tenantId, class_id, date);
      return successResponse(res, 'Data absensi halaqah berhasil dimuat.', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Riwayat absensi per santri (untuk Wali Santri atau Ustadz)
   */
  async getBySantri(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? req.tenantId : req.user.tenant_id;
      const result = await attendanceService.getBySantri(tenantId, req.params.santriId, req.query);
      return successResponse(res, 'Riwayat absensi santri berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Riwayat tanggal arsip absensi (untuk Guru / Admin)
   */
  async getHistoryDates(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const result = await attendanceService.getHistoryDates(tenantId, req.query.class_id, req.query);
      return successResponse(res, 'Daftar riwayat tanggal absensi berhasil diambil.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AttendanceController();
