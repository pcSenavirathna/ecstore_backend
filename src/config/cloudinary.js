const cloudinary = require('cloudinary').v2;

const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const isConfigured = required.every((key) => Boolean(process.env[key]));

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const assertCloudinaryConfigured = () => {
  if (!isConfigured) {
    const error = new Error('Image uploads are not configured. Set the Cloudinary environment variables.');
    error.statusCode = 503;
    throw error;
  }
};

module.exports = { cloudinary, isConfigured, assertCloudinaryConfigured };
