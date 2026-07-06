const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    missing.push(name);
    return '';
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProduction,
  port: Number(optional('PORT', '3000')),
  logLevel: optional('LOG_LEVEL', isProduction ? 'info' : 'debug'),

  databaseUrl: required('DATABASE_URL'),
  databaseSsl: optional('DATABASE_SSL', isProduction ? 'true' : 'false') === 'true',
  dbPoolMax: Number(optional('DB_POOL_MAX', '10')),

  // Comma-separated list of allowed browser origins, e.g. "https://app.example.com,https://admin.example.com"
  corsOrigins: optional('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Set true when running behind a reverse proxy/load balancer (nginx, Render, Fly, Heroku, ALB, etc.)
  // so express-rate-limit and req.ip resolve the real client IP from X-Forwarded-For.
  trustProxy: optional('TRUST_PROXY', 'false') === 'true',

  twilio: {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    verifyServiceSid: required('TWILIO_VERIFY_SERVICE_SID'),
  },

  didit: {
    baseUrl: optional('DIDIT_BASE_URL', 'https://verification.didit.me'),
    apiKey: required('DIDIT_API_KEY'),
    workflowId: required('DIDIT_WORKFLOW_ID'),
    webhookSecret: required('DIDIT_WEBHOOK_SECRET_KEY'),
    callbackUrl: required('DIDIT_CALLBACK_URL'),
  },
};

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. Check .env against .env.example.`
  );
}
