const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary, assertCloudinaryConfigured } = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const folder = file.fieldname === 'receipt' ? 'ecstore-receipts' : 'ecstore-products';
    return {
      folder,
      allowed_formats: ['jpg', 'png', 'jpeg'],
    };
  },
});

const fileFilter = (_req, file, callback) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    return callback(new Error('Only JPG, PNG, and WebP images are allowed'));
  }
  return callback(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 10 } });

// Avoid CloudinaryStorage trying to upload when a deployment was configured incorrectly.
const requireUploadConfig = (_req, _res, next) => {
  try {
    assertCloudinaryConfigured();
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { upload, requireUploadConfig };
