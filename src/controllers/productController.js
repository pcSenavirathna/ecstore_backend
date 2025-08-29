const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    const imageUrls = req.files ? req.files.map(file => file.path) : [];
    const colors = req.body.colors || req.body['colors[]'] || [];
    const productData = {
      ...req.body,
      images: imageUrls,
      colors: Array.isArray(colors) ? colors : [colors], // ensure array
    };
    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};