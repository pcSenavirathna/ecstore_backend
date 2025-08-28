const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const productController = require('../controllers/productController');

// Use 'images' as the field name, allow multiple files
router.post('/', upload.array('images', 10), productController.createProduct);

module.exports = router;