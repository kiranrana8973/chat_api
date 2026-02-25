const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

const router = express.Router();

// Helper: send push notification via FCM
const sendPushNotification = async (fcmToken, title, body, data) => {
  try {
    const admin = require('../config/firebase');
    if (!admin || !fcmToken) return;

    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (error) {
    // If token is invalid, clear it
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      await User.findOneAndUpdate({ fcmToken }, { fcmToken: '' });
    }
  }
};

// GET /api/messages/:conversationId — get paginated messages
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', '-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      messages,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/messages — send a message (text or image)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { conversationId, type, text } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required.' });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messageData = {
      conversation: conversationId,
      sender: req.user._id,
      type: type || 'text',
      text: text || '',
      readBy: [req.user._id],
    };

    // If image was uploaded
    if (req.file) {
      messageData.type = 'image';
      messageData.image = `uploads/${req.file.filename}`;
    }

    const message = await Message.create(messageData);
    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      '-password'
    );

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // Emit via Socket.IO to the other participant
    const io = req.app.get('io');
    const receiverId = conversation.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

    if (io && receiverId) {
      io.to(receiverId.toString()).emit('new-message', populatedMessage);
    }

    // Send push notification to receiver
    if (receiverId) {
      const receiver = await User.findById(receiverId);
      if (receiver && receiver.fcmToken) {
        const notificationBody =
          type === 'image' ? 'Sent you an image' : text || '';
        await sendPushNotification(
          receiver.fcmToken,
          req.user.name,
          notificationBody,
          {
            conversationId: conversationId.toString(),
            senderId: req.user._id.toString(),
            messageType: type || 'text',
          }
        );
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
