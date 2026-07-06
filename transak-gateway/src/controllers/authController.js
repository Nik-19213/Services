const authService = require('../services/authService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
  if (!email || !EMAIL_RE.test(email)) return 'A valid email is required';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.created_at };
}

async function signup(req, res, next) {
  try {
    const { email, password } = req.body;
    const validationError = validateCredentials(email, password);
    if (validationError) return res.status(400).json({ error: validationError });

    const { user, token } = await authService.signup({ email, password });
    return res.status(201).json({ user: toPublicUser(user), token });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { user, token } = await authService.login({ email, password });
    return res.json({ user: toPublicUser(user), token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { signup, login };
