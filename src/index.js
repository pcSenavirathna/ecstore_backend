require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('API is running and DB connected...');
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('./uploads', express.static('uploads')); // Serve uploaded images

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
