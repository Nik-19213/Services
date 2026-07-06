const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const apiRoutes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// Webhooks are mounted BEFORE express.json() and use their own raw-body
// parser (see routes/webhook.routes.js) so the HMAC signature can be
// verified against the exact bytes Transak sent.
app.use('/api/v1/webhooks', webhookRoutes);

// Basic rate limiting for the rest of the public/authenticated API.
app.use(
  '/api/v1',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json());
app.use('/api/v1', apiRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Transak payment gateway listening on port ${config.port} (${config.nodeEnv})`);
  logger.info(`Transak environment: ${config.transak.environment}`);
});

module.exports = app;
