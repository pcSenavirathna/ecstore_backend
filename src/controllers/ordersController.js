const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { cloudinary } = require('../config/cloudinary');
const mongoose = require('mongoose');
const { findUsableCoupon } = require('../routes/coupons');

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

const isAdminUser = async (userId) => {
	const user = await User.findById(userId).select('role');
	return !!user && user.role === 'admin';
};

const SHIPPING_FEE = Number(process.env.STANDARD_SHIPPING_FEE || 400);
const FREE_SHIPPING_ABOVE = Number(process.env.FREE_SHIPPING_ABOVE || 5000);
const returnError = (message, status = 400) => Object.assign(new Error(message), { statusCode: status });

const restoreStock = async (order) => {
  if (order.stockRestored) return;
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: Number(item.quantity) || 0 } });
  }
  order.stockRestored = true;
};

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const rawItems = parseMaybeJson(req.body.items);
    const rawAddress = parseMaybeJson(req.body.address);
    const paymentMethod = req.body.paymentMethod;
    const userId = req.userId; // From auth middleware

    const items = Array.isArray(rawItems) ? rawItems : [];
    const address = (rawAddress && typeof rawAddress === 'object' && !Array.isArray(rawAddress))
      ? rawAddress
      : null;
    // Validate required fields
    if (!items.length || !address || !['cod', 'bank'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Missing required order information' });
    }
    const requiredAddressFields = ['name', 'phone', 'street', 'city', 'province', 'country', 'zipCode'];
    if (requiredAddressFields.some((field) => !String(address[field] || '').trim())) {
      return res.status(400).json({ message: 'A complete delivery address is required' });
    }
    if (!/^\d{10}$/.test(String(address.phone))) {
      return res.status(400).json({ message: 'Enter a valid 10-digit phone number' });
    }

    if (paymentMethod === 'bank' && !req.file) {
      return res.status(400).json({ message: 'Receipt upload is required for bank deposit' });
    }

	  // Normalize and validate order items for stock handling.
	  const normalizedItems = [];
	  for (const item of items) {
		  const rawProductId = item?.productId || item?._id || item?.id;
		  const quantity = Number(item?.quantity);

		  if (!rawProductId || !mongoose.Types.ObjectId.isValid(String(rawProductId))) {
			  return res.status(400).json({ message: 'Invalid product in order items' });
		  }

		  if (!Number.isFinite(quantity) || quantity <= 0) {
			  return res.status(400).json({ message: 'Invalid item quantity in order items' });
		  }

		  normalizedItems.push({
			  productId: String(rawProductId),
		  name: '',
		  price: 0,
		  image: '',
		  variant: typeof item?.variant === 'string' ? item.variant.slice(0, 80) : '',
			  quantity,
		  });
	  }

	  // Check stock availability first.
	  const productIds = normalizedItems.map((item) => item.productId);
	  const products = await Product.find({ _id: { $in: productIds } }).select('_id stock name price images');
	  const productMap = new Map(products.map((p) => [String(p._id), p]));

	  for (const item of normalizedItems) {
		  const product = productMap.get(item.productId);
		  if (!product) {
			  return res.status(404).json({ message: `Product not found for item: ${item.name || item.productId}` });
		  }

		  if (Number(product.stock) < item.quantity) {
			  return res.status(400).json({
				  message: `Not enough stock for ${product.name}. Available: ${product.stock}, requested: ${item.quantity}`,
			  });
		  }
		  // Snapshot trusted catalog values; never accept prices or images from a browser request.
		  item.name = product.name;
		  item.price = Number(product.price);
		  item.image = product.images?.[0] || '';
	  }

	  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
	  const shippingFee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
	  let discount = 0;
	  let couponData;
	  let appliedCoupon;
	  if (req.body.couponCode) {
	    const couponResult = await findUsableCoupon(req.body.couponCode, subtotal);
	    if (!couponResult || couponResult.invalidReason) return res.status(400).json({ message: couponResult?.invalidReason || 'Invalid or expired coupon' });
	    const { coupon } = couponResult;
	    discount = coupon.type === 'percent' ? subtotal * (coupon.value / 100) : coupon.value;
	    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
	    discount = Math.min(subtotal, Math.round(discount * 100) / 100);
	    couponData = { code: coupon.code, discount };
	    appliedCoupon = coupon;
	  }

	  // Deduct stock. If a race condition occurs, rollback previous deductions.
	  const appliedDeductions = [];
	  for (const item of normalizedItems) {
		  const updated = await Product.findOneAndUpdate(
			  { _id: item.productId, stock: { $gte: item.quantity } },
			  { $inc: { stock: -item.quantity } },
			  { new: true }
		  );

		  if (!updated) {
			  // Roll back already applied deductions before returning error.
			  for (const applied of appliedDeductions) {
				  await Product.findByIdAndUpdate(applied.productId, { $inc: { stock: applied.quantity } });
			  }
			  return res.status(409).json({ message: 'Stock changed while ordering. Please refresh and try again.' });
		  }

		  appliedDeductions.push({ productId: item.productId, quantity: item.quantity });
	  }

	    // Create order object from calculated totals only.
    const orderData = {
      userId,
		items: normalizedItems,
      address,
      paymentMethod,
      orderSummary: { subtotal, shippingFee, discount, total: subtotal + shippingFee - discount },
	  ...(couponData && { coupon: couponData }),
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
	  try {
		await newOrder.save();
		if (appliedCoupon) await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
	} catch (saveError) {
		// Roll back stock deductions if order save fails.
		for (const applied of normalizedItems) {
			await Product.findByIdAndUpdate(applied.productId, { $inc: { stock: applied.quantity } });
		}
		throw saveError;
	}

    res.status(201).json({
      message: 'Order created successfully',
      order: newOrder,
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error' });
  }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name feedbacks rating reviews');

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

// Add or update feedback for a delivered item in the customer's own order
exports.addOrderItemFeedback = async (req, res) => {
	try {
		const { orderId, productId } = req.params;
		const userId = req.userId;
		const rating = Number(req.body.rating);
		const comment = String(req.body.comment || '').trim();

		if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
			return res.status(400).json({ message: 'Invalid order or product' });
		}

		if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
			return res.status(400).json({ message: 'Rating must be between 1 and 5' });
		}

		if (!comment) {
			return res.status(400).json({ message: 'Feedback comment is required' });
		}

		const order = await Order.findOne({ _id: orderId, userId });
		if (!order) {
			return res.status(404).json({ message: 'Order not found' });
		}

		if (order.orderStatus !== 'delivered') {
			return res.status(400).json({ message: 'Feedback can be added after the order is delivered' });
		}

		const hasProduct = order.items.some((item) => String(item.productId) === String(productId));
		if (!hasProduct) {
			return res.status(400).json({ message: 'This product is not in the selected order' });
		}

		const product = await Product.findById(productId);
		if (!product) {
			return res.status(404).json({ message: 'Product not found' });
		}

		const user = await User.findById(userId).select('name');
		const existingFeedback = product.feedbacks.find((feedback) =>
			String(feedback.userId) === String(userId) && String(feedback.orderId) === String(orderId)
		);

		if (existingFeedback) {
			existingFeedback.rating = rating;
			existingFeedback.comment = comment;
			existingFeedback.createdAt = new Date();
		} else {
			product.feedbacks.push({
				userId,
				userName: user?.name || 'Customer',
				orderId,
				rating,
				comment,
			});
		}

		const reviews = product.feedbacks.length;
		const totalRating = product.feedbacks.reduce((sum, feedback) => sum + (Number(feedback.rating) || 0), 0);
		product.reviews = reviews;
		product.rating = reviews > 0 ? Number((totalRating / reviews).toFixed(1)) : 0;

		await product.save();

		res.status(200).json({
			message: 'Feedback saved successfully',
			product,
		});
	} catch (error) {
		console.error('Error saving feedback:', error);
		res.status(500).json({ message: 'Server error', error: error.message });
	}
};

// Get all orders (admin only)
exports.getAllOrdersAdmin = async (req, res) => {
	try {
		const userId = req.userId;
		const isAdmin = await isAdminUser(userId);
		if (!isAdmin) {
			return res.status(403).json({ message: 'Admin access required' });
		}

		const orders = await Order.find({})
			.sort({ createdAt: -1 })
			.populate('userId', 'name email mobile')
			.populate('items.productId', 'name');

		res.status(200).json(orders);
	} catch (error) {
		console.error('Error fetching admin orders:', error);
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
	  const isAdmin = await isAdminUser(req.userId);
	  if (!isAdmin) {
		  return res.status(403).json({ message: 'Admin access required' });
	  }

    const { orderId } = req.params;
    const { orderStatus, paymentStatus, tracking } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const validPayments = ['pending', 'verified', 'failed'];
    if (orderStatus && !validStatuses.includes(orderStatus)) return res.status(400).json({ message: 'Invalid order status' });
    if (paymentStatus && !validPayments.includes(paymentStatus)) return res.status(400).json({ message: 'Invalid payment status' });
    if (orderStatus === 'cancelled') await restoreStock(order);
    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (tracking && typeof tracking === 'object') {
      order.tracking = {
        courier: String(tracking.courier || '').slice(0, 100),
        trackingNumber: String(tracking.trackingNumber || '').slice(0, 100),
        trackingUrl: String(tracking.trackingUrl || '').slice(0, 500),
      };
    }
    await order.save();

    res.status(200).json({
      message: 'Order updated successfully',
      order,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.orderStatus)) return res.status(400).json({ message: 'Only pending or confirmed orders can be cancelled' });
    order.orderStatus = 'cancelled';
    order.cancellationReason = String(req.body.reason || '').trim().slice(0, 500);
    await restoreStock(order);
    await order.save();
    return res.json({ message: 'Order cancelled successfully', order });
  } catch (error) { return res.status(500).json({ message: 'Unable to cancel order' }); }
};

exports.requestReturn = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.orderStatus !== 'delivered') return res.status(400).json({ message: 'Returns can be requested after delivery' });
    const deliveredAt = order.updatedAt || order.createdAt;
    if (Date.now() - new Date(deliveredAt).getTime() > 7 * 24 * 60 * 60 * 1000) return res.status(400).json({ message: 'Return window has expired' });
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ message: 'Please provide a return reason' });
    order.returnRequest = { requestedAt: new Date(), reason: reason.slice(0, 1000), status: 'requested' };
    await order.save();
    return res.status(201).json({ message: 'Return request submitted', order });
  } catch (error) { return res.status(500).json({ message: 'Unable to submit return request' }); }
};

exports.reorderOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.userId }).select('items');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const unavailable = [];
    const items = [];
    for (const item of order.items) {
      const product = await Product.findById(item.productId).select('_id name price images stock');
      if (!product || product.stock < item.quantity) { unavailable.push(item.name); continue; }
      items.push({ productId: product._id, name: product.name, price: product.price, image: product.images?.[0] || '', stock: product.stock, quantity: item.quantity, variant: item.variant || '' });
    }
    return res.json({ items, unavailable });
  } catch (error) { return res.status(500).json({ message: 'Unable to prepare reorder' }); }
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
