const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userModel = require('../models/userModel');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: TOKEN_EXPIRY,
  });
}

async function signup({ email, password }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    err.publicMessage = 'Email already registered';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userModel.createUser({ email, passwordHash });
  return { user, token: issueToken(user) };
}

async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    err.publicMessage = 'Invalid email or password';
    throw err;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    err.publicMessage = 'Invalid email or password';
    throw err;
  }

  return { user, token: issueToken(user) };
}

module.exports = { signup, login };
