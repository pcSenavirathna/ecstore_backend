const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0 },
  minimumOrder: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, min: 0 },
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  usageLimit: { type: Number, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
