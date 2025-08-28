const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const productController = require('../controllers/productController');
const Product = require('../models/Product');

// Use 'images' as the field name, allow multiple files
router.post('/', upload.array('images', 10), productController.createProduct);

// Get total product count
router.get('/count', async (req, res) => {
	try {
		const count = await Product.countDocuments();
		res.json({ count });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Get all products
router.get('/', async (req, res) => {
	try {
		const products = await Product.find();
		res.json(products);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

module.exports = router;