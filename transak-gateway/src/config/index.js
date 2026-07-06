require('dotenv').config();

const environment = (process.env.TRANSAK_ENVIRONMENT || 'STAGING').toUpperCase();
const isProduction = environment === 'PRODUCTION';

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:4000',

  jwtSecret: process.env.JWT_SECRET,

  databaseUrl: process.env.DATABASE_URL,

  transak: {
    environment,
    apiKey: process.env.TRANSAK_API_KEY,
    apiSecret: process.env.TRANSAK_API_SECRET,
    apiBaseUrl: isProduction
      ? process.env.TRANSAK_API_BASE_URL_PRODUCTION
      : process.env.TRANSAK_API_BASE_URL_STAGING,
    widgetUrl: isProduction
      ? process.env.TRANSAK_WIDGET_URL_PRODUCTION
      : process.env.TRANSAK_WIDGET_URL_STAGING,
    // Transak now requires widget URLs to be minted via a server-to-server
    // "create widget session" call (docs.transak.com/api/public/create-widget-url)
    // rather than built by hand as a query string — this is a different host
    // from apiBaseUrl above. Confirm the production host in your Transak
    // dashboard before going live; it's inferred here from the staging one
    // since Transak's docs didn't list it explicitly as of when this was written.
    widgetApiBaseUrl: isProduction
      ? process.env.TRANSAK_WIDGET_API_BASE_URL_PRODUCTION
      : process.env.TRANSAK_WIDGET_API_BASE_URL_STAGING,
    // Must match a domain whitelisted for your API key in the Transak
    // dashboard (Settings -> your API key -> Secure Widget URL / allowed domains).
    referrerDomain: process.env.TRANSAK_REFERRER_DOMAIN,
    webhookSecret: process.env.TRANSAK_WEBHOOK_SECRET,
    webhookSignatureHeader: (
      process.env.TRANSAK_WEBHOOK_SIGNATURE_HEADER || 'x-transak-webhook-signature'
    ).toLowerCase(),
  },
};

function assertRequiredConfig() {
  const missing = [];
  if (!config.transak.apiKey) missing.push('TRANSAK_API_KEY');
  if (!config.transak.apiSecret) missing.push('TRANSAK_API_SECRET');
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.jwtSecret) missing.push('JWT_SECRET');

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] Warning: missing env vars: ${missing.join(', ')}. ` +
        'The service will start but related features will fail until these are set.'
    );
  }
}

assertRequiredConfig();

module.exports = config;
