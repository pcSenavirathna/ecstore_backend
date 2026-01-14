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

// Update product
router.put('/:id', upload.array('images', 10), async (req, res) => {
	try {
		const productId = req.params.id;
		const { name, price, stock, description, category } = req.body;

		// Find existing product
		const existingProduct = await Product.findById(productId);
		if (!existingProduct) {
			return res.status(404).json({ message: 'Product not found' });
		}

		// Prepare update data
		const updateData = {
			name: name || existingProduct.name,
			price: price ? parseFloat(price) : existingProduct.price,
			stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
			description: description || existingProduct.description,
			category: category || existingProduct.category,
		};

		// Handle images
		if (req.files && req.files.length > 0) {
			// New images uploaded via Cloudinary
			updateData.images = req.files.map(file => file.path);
		} else if (req.body.images) {
			// Images from JSON body (existing images)
			updateData.images = Array.isArray(req.body.images)
				? req.body.images
				: [req.body.images];
		}

		const updatedProduct = await Product.findByIdAndUpdate(
			productId,
			updateData,
			{ new: true, runValidators: true }
		);

		res.json(updatedProduct);
	} catch (error) {
		console.error('Update product error:', error);
		res.status(500).json({ message: error.message });
	}
});

// Delete product
router.delete('/:id', async (req, res) => {
	try {
		const productId = req.params.id;

		// Check if product exists
		const product = await Product.findById(productId);
		if (!product) {
			return res.status(404).json({ message: 'Product not found' });
		}

		// Delete the product
		await Product.findByIdAndDelete(productId);

		console.log(`Product deleted: ${product.name} (${productId})`);

		res.json({
			message: 'Product deleted successfully',
			deletedProduct: {
				id: productId,
				name: product.name
			}
		});
	} catch (error) {
		console.error('Delete product error:', error);
		res.status(500).json({ message: error.message || 'Failed to delete product' });
	}
});

module.exports = router;