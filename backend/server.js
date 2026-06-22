require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const cfRoutes = require('./routes/cfRoutes');
const counsellorRoutes = require('./routes/counsellorRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();

// Middleware — allow all origins (required for Expo on physical devices)
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'ANC Student Docs API running' }));

// Routes
app.use('/api/cf', cfRoutes);
app.use('/api/counsellor', counsellorRoutes);
app.use('/api/student', studentRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`   Server running on http://0.0.0.0:${PORT}`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://192.168.1.x:${PORT}  (use your machine's IP in the app)`);
  });
};

if (require.main === module) {
  start();
}

module.exports = app;
