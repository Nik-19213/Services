const webpush = require("web-push");

let configured = false;

function configure() {
  if (configured) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
    throw new Error("Web push not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL missing)");
  }
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

/**
 * Send a push notification to a single subscription object.
 * @param {object} subscription  - PushSubscription JSON from the browser
 * @param {string} title
 * @param {string} body
 * @param {object} [data]        - Extra data forwarded to the service worker
 */
async function sendPush(subscription, title, body, data = {}) {
  configure();
  const payload = JSON.stringify({ title, body, data });
  await webpush.sendNotification(subscription, payload);
}

module.exports = { sendPush };
