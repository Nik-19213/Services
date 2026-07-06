const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.get('/', requireAuth, orderController.listOrders);
router.get('/:partnerOrderId', requireAuth, orderController.getOrder);
router.post('/:partnerOrderId/sync', requireAuth, orderController.syncOrder);

module.exports = router;
