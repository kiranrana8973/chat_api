const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/users — list all users except current (supports ?search=)
router.get('/', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const query = { _id: { $ne: req.user._id } };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const users = await User.find(query).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/me — get current user profile
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// PUT /api/users/me — update profile (name, avatar, fcmToken)
router.put('/me', auth, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'avatar', 'fcmToken'];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const User = require('../models/User');
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
