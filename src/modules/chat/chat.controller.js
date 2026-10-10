const chatService = require('./chat.service');
const { successResponse } = require('../../utils/response.util');

class ChatController {
  async getMessages(req, res, next) {
    try {
      const tenantId = req.user.role === 'super_admin' ? (req.query.tenant_id || req.tenantId) : req.user.tenant_id;
      const { room_type, class_id } = req.query;
      const messages = await chatService.getMessages(tenantId, room_type, class_id);
      return successResponse(res, 'Daftar pesan chat berhasil diambil.', messages);
    } catch (error) {
      next(error);
    }
  }

  async send(req, res, next) {
    try {
      const tenantId = req.user.tenant_id || req.tenantId;
      const io = req.app.get('io');
      const message = await chatService.sendMessage(tenantId, req.user.id, req.body, io);
      return successResponse(res, 'Pesan terkirim.', message, 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
