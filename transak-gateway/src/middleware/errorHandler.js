const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err.message);

  if (err.isAxiosError) {
    const status = err.response ? err.response.status : 502;
    return res.status(status).json({
      error: 'Upstream Transak API error',
      details: err.response ? err.response.data : err.message,
    });
  }

  const status = err.status || 500;
  return res.status(status).json({
    error: err.publicMessage || 'Internal server error',
  });
}

module.exports = { errorHandler };
