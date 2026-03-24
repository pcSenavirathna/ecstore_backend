const Order = require('../models/Order');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dpge0qegf',
  api_key: '188534693715682',
  api_secret: '0izpSxrxkZB9gvciVIZdrc03kY8'
});

const parseMaybeJson = (value) => {
  if (value == null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const rawItems = parseMaybeJson(req.body.items);
    const rawAddress = parseMaybeJson(req.body.address);
    const rawOrderSummary = parseMaybeJson(req.body.orderSummary);
    const paymentMethod = req.body.paymentMethod;
    const userId = req.userId; // From auth middleware

    const items = Array.isArray(rawItems) ? rawItems : [];
    const address = (rawAddress && typeof rawAddress === 'object' && !Array.isArray(rawAddress))
      ? rawAddress
      : null;
    const orderSummary = (rawOrderSummary && typeof rawOrderSummary === 'object' && !Array.isArray(rawOrderSummary))
      ? rawOrderSummary
      : null;

    // Validate required fields
    if (!items.length || !address || !paymentMethod || !orderSummary) {
      return res.status(400).json({ message: 'Missing required order information' });
    }

    if (paymentMethod === 'bank' && !req.file) {
      return res.status(400).json({ message: 'Receipt upload is required for bank deposit' });
    }

    // Create order object
    const orderData = {
      userId,
      items,
      address,
      paymentMethod,
      orderSummary,
      orderStatus: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'verified' : 'pending',
    };

    // If bank deposit with receipt file
    if (paymentMethod === 'bank' && req.file) {
      // `multer-storage-cloudinary` has already uploaded this file.
      orderData.bankTransferReceipt = {
        originalName: req.file.originalname || `receipt-${Date.now()}`,
        cloudinaryUrl: req.file.path,
        cloudinaryPublicId: req.file.filename,
      };
    }

    // Save order to database
    const newOrder = new Order(orderData);
    await newOrder.save();

    res.status(201).json({
      message: 'Order created successfully',
      order: newOrder,
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name');

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId')
      .populate('userId', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update bank transfer receipt for user's own order
exports.updateOrderReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required' });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'bank') {
      return res.status(400).json({ message: 'Receipt can only be updated for bank deposit orders' });
    }

    // Remove old receipt from Cloudinary if present.
    if (order.bankTransferReceipt && order.bankTransferReceipt.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(order.bankTransferReceipt.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete old receipt from Cloudinary:', cloudinaryError);
      }
    }

    order.bankTransferReceipt = {
      originalName: req.file.originalname || `receipt-${Date.now()}`,
      cloudinaryUrl: req.file.path,
      cloudinaryPublicId: req.file.filename,
    };

    // Re-verify payment after receipt update.
    order.paymentStatus = 'pending';
    await order.save();

    res.status(200).json({
      message: 'Receipt updated successfully',
      order,
    });
  } catch (error) {
    console.error('Error updating receipt:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        ...(orderStatus && { orderStatus }),
        ...(paymentStatus && { paymentStatus }),
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({
      message: 'Order updated successfully',
      order,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete receipt from Cloudinary (if needed)
exports.deleteReceiptFromCloudinary = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (order && order.bankTransferReceipt && order.bankTransferReceipt.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(order.bankTransferReceipt.cloudinaryPublicId);
    }
  } catch (error) {
    console.error('Error deleting receipt from Cloudinary:', error);
  }
};
