const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    const imagePaths = req.files ? req.files.map(file => file.path) : [];
    const productData = {
      ...req.body,
      images: imagePaths,
    };
    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};