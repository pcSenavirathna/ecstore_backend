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
  colors: [String], // <-- Add this line
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);