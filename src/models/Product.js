const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  originalPrice: Number,
  images: [String],
  category: String,
  description: String,
  discount: Number,
  rating: {
    type: Number,
    default: 5,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  soldCount: {
    type: Number,
    default: 0,
  },
  feedbacks: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      userName: String,
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }
  ],
  stock: Number,
  colors: [String], // Array of colors
  sizes: [String], // Array of sizes
  variantType: {
    type: String,
    enum: ['colors', 'sizes', null],
    default: null
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
