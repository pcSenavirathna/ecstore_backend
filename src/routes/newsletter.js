const express = require('express');
const Subscriber = require('../models/Subscriber');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/subscribe', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
  await Subscriber.findOneAndUpdate({ email }, { isActive: true }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return res.status(201).json({ message: 'You are subscribed to ECSTORE updates.' });
});

module.exports = router;
