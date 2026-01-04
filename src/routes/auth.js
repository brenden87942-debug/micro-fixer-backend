const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, RefreshToken } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function genAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function genRefresh() {
  return crypto.randomBytes(48).toString('hex');
}

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      role: role || 'user',
      password_hash: hash
    });

    const verifyToken = crypto.randomBytes(24).toString('hex');
    user.emailVerifyToken = verifyToken;
    await user.save();

    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      verifyToken
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  const { userId, token } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (!user || user.emailVerifyToken !== token) {
      return res.status(400).json({ ok: false, error: 'Invalid token' });
    }
    user.verified = true;
    user.emailVerifyToken = null;
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ ok: false, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ ok: false, error: 'Invalid credentials' });

    const access = genAccess(user);
    const refreshTokenStr = genRefresh();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      token: refreshTokenStr,
      userId: user.id,
      expiresAt,
      revoked: false
    });

    res.json({
      ok: true,
      token: access,
      refreshToken: refreshTokenStr,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Refresh (SINGLE route - fixed)
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (!refreshToken) {
      return res.status(400).json({ ok: false, error: 'Missing refresh token' });
    }

    const record = await RefreshToken.findOne({ where: { token: refreshToken } });

    if (!record || record.revoked || (record.expiresAt && new Date(record.expiresAt) < new Date())) {
      return res.status(400).json({ ok: false, error: 'Invalid refresh token' });
    }

    const user = await User.findByPk(record.userId);
    if (!user) return res.status(400).json({ ok: false, error: 'User not found' });

    const access = genAccess(user);
    res.json({ ok: true, token: access });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (!refreshToken) return res.json({ ok: true });

    const record = await RefreshToken.findOne({ where: { token: refreshToken } });
    if (record) {
      record.revoked = true;
      await record.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
