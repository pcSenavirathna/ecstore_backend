const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    const imageUrls = req.files ? req.files.map(file => file.path) : [];
    const colors = req.body.colors || req.body['colors[]'] || [];
    const sizes = req.body.sizes || req.body['sizes[]'] || [];
    const variantType = req.body.variantType || null;

    const name = String(req.body.name || '').trim();
    const price = Number(req.body.price);
    const stock = Number(req.body.stock);
    const category = String(req.body.category || '').trim();
    if (!name || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ message: 'Name, category, non-negative price, and stock are required' });
    }

    const productData = {
      ...req.body,
      name,
      price,
      stock,
      category,
      images: imageUrls,
      colors: Array.isArray(colors) ? colors : (colors ? [colors] : []),
      sizes: Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []),
      variantType: variantType,
    };

    const product = await Product.create(productData);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
