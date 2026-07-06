const { v4: uuidv4 } = require('uuid');
const orderModel = require('../models/orderModel');
const transakClient = require('../services/transakClient');

function generatePartnerOrderId() {
  return `po_${uuidv4()}`;
}

async function createPendingOrder({
  userId,
  orderType,
  fiatCurrency,
  fiatAmount,
  cryptoCurrency,
  network,
  walletAddress,
  paymentMethod,
  redirectUrl,
}) {
  const partnerOrderId = generatePartnerOrderId();
  return orderModel.createOrder({
    partnerOrderId,
    userId,
    orderType,
    fiatCurrency,
    fiatAmount,
    cryptoCurrency,
    network,
    walletAddress,
    paymentMethod,
    redirectUrl,
  });
}

async function getOrderForUser(userId, partnerOrderId) {
  const order = await orderModel.findByPartnerOrderId(partnerOrderId);
  if (!order || order.user_id !== userId) return null;
  return order;
}

async function listOrdersForUser(userId, pagination) {
  return orderModel.listByUser(userId, pagination);
}

/** Pull the latest status directly from Transak (useful if a webhook was missed). */
async function syncOrderWithTransak(userId, partnerOrderId) {
  const order = await getOrderForUser(userId, partnerOrderId);
  if (!order) return null;
  if (!order.transak_order_id) {
    // We don't know Transak's order id yet (widget session not completed / no webhook yet).
    return order;
  }

  const remote = await transakClient.getOrderById(order.transak_order_id);
  const updated = await orderModel.updateFromWebhook(partnerOrderId, {
    transakOrderId: remote.id || order.transak_order_id,
    status: remote.status,
    cryptoAmount: remote.cryptoAmount,
    payload: remote,
  });
  return updated;
}

async function applyWebhookUpdate({ partnerOrderId, transakOrderId, status, cryptoAmount, payload }) {
  if (!partnerOrderId) return null;
  return orderModel.updateFromWebhook(partnerOrderId, {
    transakOrderId,
    status,
    cryptoAmount,
    payload,
  });
}

module.exports = {
  createPendingOrder,
  getOrderForUser,
  listOrdersForUser,
  syncOrderWithTransak,
  applyWebhookUpdate,
};
