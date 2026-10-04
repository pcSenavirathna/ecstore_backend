const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  price: { type: Number, required: true, min: 0 },
  originalPrice: Number,
  images: { type: [String], default: [] },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 5000 },
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
  stock: { type: Number, required: true, min: 0, default: 0 },
  colors: [String], // Array of colors
  sizes: [String], // Array of sizes
  variantType: {
    type: String,
    enum: ['colors', 'sizes', null],
    default: null
  },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
