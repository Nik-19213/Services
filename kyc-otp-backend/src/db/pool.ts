import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../logger';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: env.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// A pooled connection can go bad while idle (network blip, DB restart); without this
// handler that surfaces as an uncaught 'error' event and crashes the process.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle Postgres client');
});
