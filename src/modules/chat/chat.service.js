const db = require('../../config/database');

class ChatService {
  async getMessages(tenantId, roomType = 'class_group', classId = null) {
    let query = db('chat_messages')
      .leftJoin('users as sender', 'chat_messages.sender_id', 'sender.id')
      .where({
        'chat_messages.tenant_id': tenantId,
        'chat_messages.room_type': roomType,
      })
      .select(
        'chat_messages.*',
        'sender.name as sender_name',
        'sender.role as sender_role',
        'sender.avatar_url as sender_avatar'
      );

    if (classId) {
      query = query.where('chat_messages.class_id', classId);
    }

    return query.orderBy('chat_messages.created_at', 'asc').limit(100);
  }

  async sendMessage(tenantId, senderId, data, io = null) {
    const { room_type, class_id, message, attachment_url } = data;

    if (!message || !message.trim()) {
      const err = new Error('Pesan tidak boleh kosong.');
      err.statusCode = 400;
      throw err;
    }

    const [id] = await db('chat_messages').insert({
      tenant_id: tenantId,
      sender_id: senderId,
      class_id: class_id || null,
      room_type: room_type || 'class_group',
      message: message.trim(),
      attachment_url: attachment_url || null,
    });

    const inserted = await db('chat_messages')
      .leftJoin('users as sender', 'chat_messages.sender_id', 'sender.id')
      .where({ 'chat_messages.id': id })
      .select(
        'chat_messages.*',
        'sender.name as sender_name',
        'sender.role as sender_role'
      )
      .first();

    // Emit Socket.io event if io instance provided
    if (io) {
      const roomName = room_type === 'kajian_channel'
        ? `tenant_${tenantId}_kajian`
        : (class_id ? `tenant_${tenantId}_class_${class_id}` : `tenant_${tenantId}_class_group`);

      io.to(roomName).emit('new_message', inserted);
      io.to(`tenant_${tenantId}`).emit('new_message', inserted);
      io.emit('new_message', inserted);
    }

    return inserted;
  }
}

module.exports = new ChatService();
