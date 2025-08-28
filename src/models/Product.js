const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  originalPrice: Number,
  images: [String], // Array of image URLs/paths
  category: String,
  description: String,
  discount: Number,
  stock: Number,
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);