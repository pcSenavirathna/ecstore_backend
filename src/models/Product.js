const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  originalPrice: Number,
  images: [String],
  category: String,
  description: String,
  discount: Number,
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