const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
  try {
    const imageUrls = req.files ? req.files.map(file => file.path) : [];
    const colors = req.body.colors || req.body['colors[]'] || [];
    const sizes = req.body.sizes || req.body['sizes[]'] || [];
    const variantType = req.body.variantType || null;

    console.log('=== CREATE PRODUCT DEBUG ===');
    console.log('req.body.colors:', req.body.colors);
    console.log('req.body[colors[]]:', req.body['colors[]']);
    console.log('Extracted colors:', colors);
    console.log('req.body.variantType:', req.body.variantType);
    console.log('Extracted variantType:', variantType);

    const productData = {
      ...req.body,
      images: imageUrls,
      colors: Array.isArray(colors) ? colors : (colors ? [colors] : []),
      sizes: Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []),
      variantType: variantType,
    };

    console.log('Final productData:', productData);
    const product = await Product.create(productData);
    console.log('Created product:', product);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};