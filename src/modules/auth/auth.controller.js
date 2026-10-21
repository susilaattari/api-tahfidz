const authService = require('./auth.service');
const { successResponse, errorResponse } = require('../../utils/response.util');

class AuthController {
  async login(req, res, next) {
    try {
      const { login, email, phone, password } = req.body;
      const loginIdentifier = login || email || phone;
      const result = await authService.login(loginIdentifier, password);
      return successResponse(res, 'Login berhasil.', result);
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      return successResponse(res, 'Data profil berhasil diambil.', user);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res) {
    return successResponse(res, 'Logout berhasil.');
  }

  async changePassword(req, res, next) {
    try {
      const { current_password, old_password, new_password } = req.body;
      const curPass = current_password || old_password;
      await authService.changePassword(req.user.id, curPass, new_password);
      return successResponse(res, 'Kata sandi berhasil diperbarui.');
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req, res, next) {
    try {
      const { email, type = 'registration' } = req.body;
      const result = await authService.sendOtp(email, type);
      return successResponse(res, 'Kode verifikasi OTP telah dikirim ke email Anda.', result);
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { email, otp_code, code, type = 'registration' } = req.body;
      const otpCode = otp_code || code;
      const result = await authService.verifyOtp(email, otpCode, type);
      return successResponse(res, 'Verifikasi kode OTP berhasil.', result);
    } catch (error) {
      next(error);
    }
  }

  async impersonate(req, res, next) {
    try {
      const result = await authService.impersonate(req.user, req.params.tenantId);
      return successResponse(res, `Berhasil masuk sebagai Admin ${result.user.tenant.name}.`, result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();

