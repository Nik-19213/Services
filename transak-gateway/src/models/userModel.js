const { query } = require('../config/database');

async function createUser({ email, passwordHash }) {
  const result = await query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`,
    [email, passwordHash]
  );
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

module.exports = { createUser, findByEmail };
