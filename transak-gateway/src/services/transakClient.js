const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Thin wrapper around Transak's server-to-server (partner) API.
 *
 * Confirm exact paths against current Transak docs (docs.transak.com) before
 * going to production — third-party APIs evolve and this was built from
 * Transak's documented partner-API pattern as of early 2026:
 *
 *   POST {apiBaseUrl}/partners/api/v2/refresh-token   (api-secret header)  -> access token
 *   GET  {apiBaseUrl}/partners/api/v2/order/:orderId  (access-token header) -> order detail
 *   GET  {apiBaseUrl}/api/v2/currencies/price                              -> public price quote
 *   GET  {apiBaseUrl}/api/v2/currencies/crypto-currencies                  -> public list
 *   GET  {apiBaseUrl}/api/v2/currencies/fiat-currencies                    -> public list
 *
 *   POST {widgetApiBaseUrl}/api/v2/auth/session (access-token header)      -> widget session URL
 *     Transak deprecated building the widget URL by hand as a query string —
 *     it must now be minted via this endpoint, which lives on a different
 *     host (widgetApiBaseUrl, not apiBaseUrl). See
 *     docs.transak.com/api/public/create-widget-url. Must be called only
 *     from your backend, per Transak's docs.
 */

const http = axios.create({
  baseURL: config.transak.apiBaseUrl,
  timeout: 15000,
});

const widgetHttp = axios.create({
  baseURL: config.transak.widgetApiBaseUrl,
  timeout: 15000,
});

let cachedToken = null; // { accessToken, expiresAt: epochMs }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) {
    return cachedToken.accessToken;
  }

  const response = await http.post(
    '/partners/api/v2/refresh-token',
    { apiKey: config.transak.apiKey },
    { headers: { 'api-secret': config.transak.apiSecret } }
  );

  const data = response.data && response.data.data ? response.data.data : response.data;
  const accessToken = data.accessToken;
  const expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 5 * 60_000;

  if (!accessToken) {
    throw new Error('Transak refresh-token response did not include accessToken');
  }

  cachedToken = { accessToken, expiresAt };
  logger.info('[transakClient] Refreshed access token');
  return accessToken;
}

async function authedRequest(method, url, { params, data } = {}) {
  const accessToken = await getAccessToken();
  return http.request({
    method,
    url,
    params,
    data,
    headers: { 'access-token': accessToken },
  });
}

/** Fetch a single order by Transak's own order id. */
async function getOrderById(transakOrderId) {
  const res = await authedRequest('get', `/partners/api/v2/order/${transakOrderId}`);
  return res.data.data || res.data;
}

/**
 * Mint a widget session URL (mandatory since Transak's "Secure Widget URL"
 * migration — see docs.transak.com/api/public/create-widget-url). Returns
 * a ready-to-use widgetUrl with a short-lived, single-use sessionId embedded;
 * we can no longer build this URL ourselves from query params.
 *
 * `userIp` is optional and best-effort — some Transak docs list `x-user-ip`
 * as a header for this endpoint, others don't show it. Confirm against your
 * dashboard/support if session creation ever rejects requests without it.
 */
async function createWidgetSession(widgetParams, userIp) {
  const accessToken = await getAccessToken();
  const res = await widgetHttp.post(
    '/api/v2/auth/session',
    { widgetParams },
    {
      headers: {
        'access-token': accessToken,
        ...(userIp ? { 'x-user-ip': userIp } : {}),
      },
    }
  );

  const data = res.data && res.data.data ? res.data.data : res.data;
  if (!data.widgetUrl) {
    throw new Error('Transak create-widget-session response did not include widgetUrl');
  }
  return data.widgetUrl;
}

/** Public price quote — no access token required, just the API key. */
async function getPriceQuote(params) {
  const res = await http.get('/api/v2/currencies/price', {
    params: { partnerApiKey: config.transak.apiKey, ...params },
  });
  return res.data.response || res.data;
}

async function getCryptoCurrencies() {
  const res = await http.get('/api/v2/currencies/crypto-currencies');
  return res.data.response || res.data;
}

async function getFiatCurrencies() {
  const res = await http.get('/api/v2/currencies/fiat-currencies');
  return res.data.response || res.data;
}

module.exports = {
  getAccessToken,
  getOrderById,
  createWidgetSession,
  getPriceQuote,
  getCryptoCurrencies,
  getFiatCurrencies,
};
