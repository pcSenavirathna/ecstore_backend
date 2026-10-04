const express = require('express');
const Coupon = require('../models/Coupon');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

const router = express.Router();
const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const findUsableCoupon = async (code, subtotal = 0) => {
  const coupon = await Coupon.findOne({ code: normalizeCode(code), isActive: true });
  const now = new Date();
  if (!coupon || coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt < now) || (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)) return null;
  if (Number(subtotal) < coupon.minimumOrder) return { coupon, invalidReason: `Minimum order is Rs. ${coupon.minimumOrder}` };
  return { coupon };
};

router.post('/validate', async (req, res) => {
  try {
    const result = await findUsableCoupon(req.body.code, Number(req.body.subtotal) || 0);
    if (!result || result.invalidReason) return res.status(400).json({ message: result?.invalidReason || 'Invalid or expired coupon' });
    const { coupon } = result;
    res.json({ code: coupon.code, type: coupon.type, value: coupon.value, minimumOrder: coupon.minimumOrder, maxDiscount: coupon.maxDiscount });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to validate coupon' });
  }
});

router.get('/', auth, admin, async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 })));
router.post('/', auth, admin, async (req, res) => {
  try { res.status(201).json(await Coupon.create({ ...req.body, code: normalizeCode(req.body.code) })); }
  catch (error) { res.status(400).json({ message: error.message }); }
});
router.put('/:id', auth, admin, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.code) update.code = normalizeCode(update.code);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    return res.json(coupon);
  } catch (error) { return res.status(400).json({ message: error.message }); }
});
router.delete('/:id', auth, admin, async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
  return res.json({ message: 'Coupon deleted' });
});

module.exports = { router, findUsableCoupon };
