const express = require('express');
const router = express.Router();
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderReceipt,
  updateOrderStatus,
} = require('../controllers/ordersController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Create a new order (protected - with optional file upload for bank receipt)
router.post('/', authMiddleware, upload.single('receipt'), createOrder);

// Get all orders for logged-in user (protected)
router.get('/', authMiddleware, getUserOrders);

// Get specific order by ID (protected)
router.get('/:orderId', authMiddleware, getOrderById);

// Update bank transfer receipt (protected)
router.put('/:orderId/receipt', authMiddleware, upload.single('receipt'), updateOrderReceipt);

// Update order status (protected)
router.put('/:orderId/status', authMiddleware, updateOrderStatus);

module.exports = router;
