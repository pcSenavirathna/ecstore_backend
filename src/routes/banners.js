const express = require('express');
const Banner = require('../models/Banner');
const authMiddleware = require('../middlewares/auth');
const adminMiddleware = require('../middlewares/admin');

const router = express.Router();

const sortBanners = { sortOrder: 1, createdAt: -1 };

// Public storefront banners: only active entries are visible.
router.get('/', async (_req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort(sortBanners);
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load banners' });
  }
});

// Admin management list includes hidden banners too.
router.get('/manage', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const banners = await Banner.find().sort(sortBanners);
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load banners' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const banner = await Banner.create({
      title: req.body.title,
      subtitle: req.body.subtitle,
      image: req.body.image,
      buttonText: req.body.buttonText || '',
      buttonLink: req.body.buttonLink || '',
      isActive: req.body.isActive !== false,
      sortOrder: Number(req.body.sortOrder) || 0,
    });
    res.status(201).json(banner);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to create banner' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        subtitle: req.body.subtitle,
        image: req.body.image,
        buttonText: req.body.buttonText || '',
        buttonLink: req.body.buttonLink || '',
        isActive: req.body.isActive !== false,
        sortOrder: Number(req.body.sortOrder) || 0,
      },
      { new: true, runValidators: true }
    );

    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update banner' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to delete banner' });
  }
});

module.exports = router;
