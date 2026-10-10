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
}

module.exports = new AuthController();

