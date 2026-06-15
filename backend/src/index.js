require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const excelRoutes = require('./routes/excelRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all in local/development environments
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serving uploaded files for inspection if needed
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/billing', billingRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({
    name: 'ShipSync API Server',
    version: '1.0.0',
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Error Handler caught:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 SHIPSNC API SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📁 Database: SQLite via Prisma ORM`);
  console.log(`🌐 API Endpoint: http://localhost:${PORT}`);
  console.log(`========================================`);
});
