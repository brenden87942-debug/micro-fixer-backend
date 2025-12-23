const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, RefreshToken } = require('../models');

function genAccess(user) {
  return jwt.sign({ id:user.id, role:user.role }, process.env.JWT_SECRET || 'change_this_secret', { expiresIn:'15m' });
}
function genRefresh() {
  return crypto.randomBytes(48).toString('hex');
}

// Register
router.post('/register', async (req,res) => {
  const { name, email, password, phone, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, role:role||'user', password_hash:hash });
    const verifyToken = crypto.randomBytes(24).toString('hex');
    user.emailVerifyToken = verifyToken;
    await user.save();
    res.json({ ok:true, user:{ id:user.id, email:user.email, name:user.name, role:user.role }, verifyToken });
  } catch (e) {
    res.status(400).json({ ok:false, error:e.message });
  }
});

// Verify email
router.post('/verify-email', async (req,res) => {
  const { userId, token } = req.body;
  const user = await User.findByPk(userId);
  if (!user || user.emailVerifyToken !== token) {
    return res.status(400).json({ ok:false, error:'Invalid token' });
  }
  user.verified = true;
  user.emailVerifyToken = null;
  await user.save();
  res.json({ ok:true });
});

// Login
router.post('/login', async (req,res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where:{ email } });
  if (!user) return res.status(400).json({ ok:false, error:'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(400).json({ ok:false, error:'Invalid credentials' });
  const access = genAccess(user);
  const refreshTokenStr = genRefresh();
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
  await RefreshToken.create({ token:refreshTokenStr, userId:user.id, expiresAt });
  res.json({ ok:true, token:access, refreshToken:refreshTokenStr, user:{ id:user.id, email:user.email, name:user.name, role:user.role } });
});
// Refresh access token using refreshToken
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ ok: false, error: "Missing refreshToken" });

    // Find refresh token record
    const rt = await RefreshToken.findOne({ where: { token: refreshToken } });
    if (!rt) return res.status(401).json({ ok: false, error: "Refresh token invalid" });

    // Optional: if your model has expiresAt / revokedAt, enforce them:
    if (rt.expiresAt && new Date(rt.expiresAt) < new Date()) {
      return res.status(401).json({ ok: false, error: "Refresh token expired" });
    }
    if (rt.revokedAt) {
      return res.status(401).json({ ok: false, error: "Refresh token revoked" });
    }

    // Load user
    const user = await User.findByPk(rt.userId);
    if (!user) return res.status(401).json({ ok: false, error: "User not found" });

    // Issue new access token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // keep short; refresh handles the rest
    );

    return res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});


// Refresh
router.post('/refresh', async (req,res) => {
  const { refreshToken } = req.body;
  const record = await RefreshToken.findOne({ where:{ token:refreshToken }});
  if (!record || record.revoked || new Date(record.expiresAt) < new Date()) {
    return res.status(400).json({ ok:false, error:'Invalid refresh token' });
  }
  const user = await User.findByPk(record.userId);
  if (!user) return res.status(400).json({ ok:false, error:'User not found' });
  const access = genAccess(user);
  res.json({ ok:true, token:access });
});

// Logout
router.post('/logout', async (req,res) => {
  const { refreshToken } = req.body;
  const record = await RefreshToken.findOne({ where:{ token:refreshToken }});
  if (record) {
    record.revoked = true;
    await record.save();
  }
  res.json({ ok:true });
});

module.exports = router;
