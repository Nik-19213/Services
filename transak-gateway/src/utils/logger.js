/* Minimal structured logger. Swap for pino/winston in a real deployment. */

function timestamp() {
  return new Date().toISOString();
}

function info(message, meta) {
  // eslint-disable-next-line no-console
  console.log(`[${timestamp()}] INFO  ${message}`, meta !== undefined ? meta : '');
}

function warn(message, meta) {
  // eslint-disable-next-line no-console
  console.warn(`[${timestamp()}] WARN  ${message}`, meta !== undefined ? meta : '');
}

function error(message, meta) {
  // eslint-disable-next-line no-console
  console.error(`[${timestamp()}] ERROR ${message}`, meta !== undefined ? meta : '');
}

module.exports = { info, warn, error };
