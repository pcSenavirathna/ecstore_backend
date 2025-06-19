require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running and DB connected...');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
