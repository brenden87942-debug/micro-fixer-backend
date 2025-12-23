const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok:false, error: 'Missing token' });

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok:false, error: 'Invalid token format' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_this_secret');
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ ok:false, error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ ok:false, error: 'Token invalid or expired' });
  }
}

module.exports = { authenticate };
