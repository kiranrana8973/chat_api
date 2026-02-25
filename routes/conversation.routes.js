const express = require('express');
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');

const router = express.Router();

// POST /api/conversations — create or get existing conversation
router.post('/', auth, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required.' });
    }

    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself.' });
    }

    // Check if conversation already exists between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, participantId] },
    })
      .populate('participants', '-password')
      .populate('lastMessage');

    if (conversation) {
      return res.json(conversation);
    }

    // Create new conversation
    conversation = new Conversation({
      participants: [req.user._id, participantId],
    });
    await conversation.save();

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', '-password')
      .populate('lastMessage');

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversations — list user's conversations
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
