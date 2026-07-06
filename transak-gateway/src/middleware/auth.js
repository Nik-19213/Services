const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * This service assumes your main application already handles signup/login.
 * It expects a bearer JWT (issued by your existing auth system, signed with
 * the same JWT_SECRET) and just pulls the user id out of it so orders can be
 * scoped per user. Swap this out for however your project actually
 * authenticates requests (session cookie, API gateway header, etc.) if a
 * shared-secret JWT isn't the right fit.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.sub || decoded.userId || decoded.id;
    if (!req.userId) {
      return res.status(401).json({ error: 'Token missing a user identifier' });
    }
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
