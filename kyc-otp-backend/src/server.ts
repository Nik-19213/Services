import 'dotenv/config';
import { env } from './config/env';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { pool } from './db/pool';
import otpRoutes from './routes/otpRoutes';
import kycRoutes from './routes/kycRoutes';

const app = express();

// Required behind a reverse proxy/load balancer (nginx, Render, Fly, Heroku, ALB) so
// express-rate-limit and req.ip read the real client IP from X-Forwarded-For rather
// than the proxy's own address.
app.set('trust proxy', env.trustProxy ? 1 : false);

app.use(helmet());
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
app.use(pinoHttp({ logger }));

// Stash the raw body bytes alongside the parsed JSON so the Didit webhook route
// can verify its HMAC signature over the exact bytes Didit sent.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

app.use('/api/otp', otpRoutes);
app.use('/api/kyc', kycRoutes);

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Health check failed: database unreachable');
    return res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Must have 4 args for Express to treat this as an error handler.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to database on startup');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} (${env.nodeEnv})`);
  });

  function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await pool.end();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Don't hang forever waiting on in-flight requests/connections.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

start();
