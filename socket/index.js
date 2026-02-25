const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

module.exports = (io) => {
  // Authenticate socket connections via JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('Authentication error: User not found.'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.userId})`);

    // Join personal room
    socket.join(socket.userId);

    // Mark user as online
    User.findByIdAndUpdate(socket.userId, { isOnline: true }).exec();
    socket.broadcast.emit('user-online', { userId: socket.userId });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, text, type } = data;

        // Verify participation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId,
        });

        if (!conversation) return;

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          type: type || 'text',
          text: text || '',
          readBy: [socket.userId],
        });

        const populatedMessage = await Message.findById(message._id).populate(
          'sender',
          '-password'
        );

        // Update conversation lastMessage
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
        });

        // Find receiver
        const receiverId = conversation.participants.find(
          (p) => p.toString() !== socket.userId
        );

        if (receiverId) {
          // Emit to receiver
          io.to(receiverId.toString()).emit('new-message', populatedMessage);

          // Send push notification
          try {
            const receiver = await User.findById(receiverId);
            if (receiver && receiver.fcmToken) {
              const admin = require('../config/firebase');
              if (admin) {
                const notificationBody =
                  type === 'image' ? 'Sent you an image' : text || '';
                await admin.messaging().send({
                  token: receiver.fcmToken,
                  notification: {
                    title: socket.user.name,
                    body: notificationBody,
                  },
                  data: {
                    conversationId: conversationId.toString(),
                    senderId: socket.userId,
                    messageType: type || 'text',
                  },
                  android: { priority: 'high' },
                  apns: {
                    payload: { aps: { sound: 'default', badge: 1 } },
                  },
                });
              }
            }
          } catch (pushError) {
            // Push notification failure should not break messaging
            console.error('Push notification error:', pushError.message);
          }
        }

        // Emit back to sender for confirmation
        socket.emit('new-message', populatedMessage);
      } catch (error) {
        console.error('send-message error:', error.message);
      }
    });

    // Typing indicators
    socket.on('typing', (data) => {
      const { conversationId, receiverId } = data;
      if (receiverId) {
        io.to(receiverId).emit('typing', {
          conversationId,
          senderId: socket.userId,
        });
      }
    });

    socket.on('stop-typing', (data) => {
      const { conversationId, receiverId } = data;
      if (receiverId) {
        io.to(receiverId).emit('stop-typing', {
          conversationId,
          senderId: socket.userId,
        });
      }
    });

    // Mark messages as read
    socket.on('mark-read', async (data) => {
      try {
        const { conversationId } = data;

        await Message.updateMany(
          {
            conversation: conversationId,
            readBy: { $ne: socket.userId },
          },
          { $addToSet: { readBy: socket.userId } }
        );

        // Notify the other participant
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          const otherUserId = conversation.participants.find(
            (p) => p.toString() !== socket.userId
          );
          if (otherUserId) {
            io.to(otherUserId.toString()).emit('messages-read', {
              conversationId,
              readByUserId: socket.userId,
            });
          }
        }
      } catch (error) {
        console.error('mark-read error:', error.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.userId})`);
      User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      }).exec();
      socket.broadcast.emit('user-offline', {
        userId: socket.userId,
        lastSeen: new Date(),
      });
    });
  });
};
