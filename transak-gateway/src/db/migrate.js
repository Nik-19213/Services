const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // eslint-disable-next-line no-console
  console.log('[migrate] Applying schema.sql ...');
  try {
    await pool.query(sql);
    // eslint-disable-next-line no-console
    console.log('[migrate] Done.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[migrate] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
