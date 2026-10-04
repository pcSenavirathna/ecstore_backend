require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const bannerRoutes = require('./routes/banners');
const { router: couponRoutes } = require('./routes/coupons');
const newsletterRoutes = require('./routes/newsletter');
const cors = require('cors');
const { createRateLimiter, securityHeaders } = require('./middlewares/security');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(createRateLimiter({ limit: 300 }));

app.get('/', (_req, res) => {
  res.json({ message: 'ECSTORE API is running' });
});
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', createRateLimiter({ limit: 12, message: 'Too many authentication attempts. Please wait and try again.' }), authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use((error, _req, res, _next) => {
  const status = error.statusCode || (error.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ message: error.message || 'Unexpected server error' });
});


const startServer = async () => {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('A strong JWT_SECRET (32+ characters) is required in production');
  }
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
