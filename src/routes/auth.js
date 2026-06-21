const express = require('express');
const router = express.Router();
const {
	signup,
	login,
	googleAuth,
	getMe,
	updateMe,
	addAddress,
	updateAddress,
	setDefaultAddress,
	deleteAddress,
	changePassword,
	deleteMe,
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
router.post('/me/addresses', authMiddleware, addAddress);
router.put('/me/addresses/:addressId', authMiddleware, updateAddress);
router.put('/me/addresses/:addressId/default', authMiddleware, setDefaultAddress);
router.delete('/me/addresses/:addressId', authMiddleware, deleteAddress);
router.put('/change-password', authMiddleware, changePassword);
router.delete('/me', authMiddleware, deleteMe);

module.exports = router;
