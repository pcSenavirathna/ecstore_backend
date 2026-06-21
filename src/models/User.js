const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	name: { type: String, required: true },
	email: { type: String, required: true, unique: true, lowercase: true, trim: true },
	password: { type: String },
	mobile: { type: String, trim: true, default: '' },
	role: { type: String, default: 'user' },
	addresses: [
		{
			name: { type: String, trim: true, default: '' },
			phone: { type: String, trim: true, default: '' },
			street: { type: String, trim: true, default: '' },
			city: { type: String, trim: true, default: '' },
			province: { type: String, trim: true, default: '' },
			country: { type: String, trim: true, default: 'Sri Lanka' },
			zipCode: { type: String, trim: true, default: '' },
			isDefault: { type: Boolean, default: false },
		}
	],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
