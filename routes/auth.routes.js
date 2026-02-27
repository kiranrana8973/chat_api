const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { verifyGoogleToken, verifyAppleToken } = require('../config/oauth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fname, lname, email, password, gender, batch } = req.body;

    if (!fname || !lname || !email || !password) {
      return res
        .status(400)
        .json({ error: 'First name, last name, email, and password are required.' });
    }

    if (!gender || !['male', 'female', 'other'].includes(gender)) {
      return res
        .status(400)
        .json({ error: 'Gender is required and must be male, female, or other.' });
    }

    if (!batch) {
      return res.status(400).json({ error: 'Batch is required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    const user = new User({
      fname,
      lname,
      email,
      password,
      gender,
      batch,
      authProvider: 'local',
      isProfileComplete: true,
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.authProvider !== 'local') {
      return res.status(401).json({
        error: `This account uses ${user.authProvider} sign-in. Please use ${user.authProvider} to log in.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const googleData = await verifyGoogleToken(idToken);

    // Check if this Google account already exists
    let user = await User.findOne({ authProvider: 'google', oauthId: googleData.oauthId });

    if (user) {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      return res.json({ token, user, isNewUser: false });
    }

    // Check if email is used by a local account — link it
    const existingLocalUser = await User.findOne({
      email: googleData.email,
      authProvider: 'local',
    });

    if (existingLocalUser) {
      existingLocalUser.authProvider = 'google';
      existingLocalUser.oauthId = googleData.oauthId;
      if (!existingLocalUser.avatar && googleData.avatar) {
        existingLocalUser.avatar = googleData.avatar;
      }
      await existingLocalUser.save();

      const token = jwt.sign({ userId: existingLocalUser._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      return res.json({ token, user: existingLocalUser, isNewUser: false });
    }

    // Check if email is used by a different OAuth provider
    const existingOAuthUser = await User.findOne({ email: googleData.email });
    if (existingOAuthUser) {
      return res.status(409).json({
        error: `This email is already registered with ${existingOAuthUser.authProvider} sign-in.`,
      });
    }

    // New user
    user = new User({
      fname: googleData.fname || 'User',
      lname: googleData.lname || '',
      email: googleData.email,
      authProvider: 'google',
      oauthId: googleData.oauthId,
      avatar: googleData.avatar,
      isProfileComplete: false,
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user, isNewUser: true });
  } catch (error) {
    if (
      error.message.includes('Token used too late') ||
      error.message.includes('Invalid token')
    ) {
      return res.status(401).json({ error: 'Invalid or expired Google token.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/apple
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fname, lname } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Apple identity token is required.' });
    }

    const appleData = await verifyAppleToken(identityToken);

    // Check if this Apple account already exists
    let user = await User.findOne({ authProvider: 'apple', oauthId: appleData.oauthId });

    if (user) {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });
      return res.json({ token, user, isNewUser: false });
    }

    const email = appleData.email;

    if (email) {
      // Check for existing local account — link it
      const existingLocalUser = await User.findOne({ email, authProvider: 'local' });

      if (existingLocalUser) {
        existingLocalUser.authProvider = 'apple';
        existingLocalUser.oauthId = appleData.oauthId;
        await existingLocalUser.save();

        const token = jwt.sign({ userId: existingLocalUser._id }, process.env.JWT_SECRET, {
          expiresIn: '7d',
        });
        return res.json({ token, user: existingLocalUser, isNewUser: false });
      }

      // Check for different OAuth provider
      const existingOAuthUser = await User.findOne({ email });
      if (existingOAuthUser) {
        return res.status(409).json({
          error: `This email is already registered with ${existingOAuthUser.authProvider} sign-in.`,
        });
      }
    }

    // New user — fname/lname come from request body (Apple only provides name client-side on first auth)
    user = new User({
      fname: fname || 'User',
      lname: lname || '',
      email: email || `apple_${appleData.oauthId}@privaterelay.appleid.com`,
      authProvider: 'apple',
      oauthId: appleData.oauthId,
      isProfileComplete: false,
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user, isNewUser: true });
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({ error: 'Invalid or expired Apple token.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/complete-profile (requires auth)
router.post('/complete-profile', auth, async (req, res) => {
  try {
    const { gender, batch, fname, lname } = req.body;

    if (!gender || !['male', 'female', 'other'].includes(gender)) {
      return res
        .status(400)
        .json({ error: 'Gender is required and must be male, female, or other.' });
    }

    if (!batch) {
      return res.status(400).json({ error: 'Batch is required.' });
    }

    const updates = { gender, batch, isProfileComplete: true };

    if (fname) updates.fname = fname;
    if (lname) updates.lname = lname;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
