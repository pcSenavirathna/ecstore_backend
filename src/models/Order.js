const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      name: String,
      price: Number,
      image: String,
      quantity: Number,
      variant: { type: String, default: '' },
    }
  ],
  address: {
    name: String,
    phone: String,
    street: String,
    city: String,
    province: String,
    country: String,
    zipCode: String,
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'bank'],
    required: true
  },
  bankTransferReceipt: {
    originalName: String,
    cloudinaryUrl: String,
    cloudinaryPublicId: String,
  },
  orderSummary: {
    subtotal: Number,
    shippingFee: Number,
    discount: { type: Number, default: 0 },
    total: Number,
  },
  coupon: {
    code: String,
    discount: Number,
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  tracking: {
    courier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
  },
  cancellationReason: { type: String, default: '' },
  returnRequest: {
    requestedAt: Date,
    reason: String,
    status: { type: String, enum: ['requested', 'approved', 'rejected', 'received', 'refunded'] },
  },
  stockRestored: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
