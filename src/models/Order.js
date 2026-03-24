const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      image: String,
      quantity: Number,
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
    total: Number,
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
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
