const orderService = require('../services/orderService');

async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderForUser(req.userId, req.params.partnerOrderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order });
  } catch (err) {
    return next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const orders = await orderService.listOrdersForUser(req.userId, { limit, offset });
    return res.json({ orders, limit, offset });
  } catch (err) {
    return next(err);
  }
}

async function syncOrder(req, res, next) {
  try {
    const order = await orderService.syncOrderWithTransak(req.userId, req.params.partnerOrderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getOrder, listOrders, syncOrder };
