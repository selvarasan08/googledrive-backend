require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();

connectDB();

// CORS Configuration - FIXED FOR YOUR SETUP
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://googledrive-frontend.netlify.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    console.log('Request from origin:', origin); // DEBUG
    
    // Allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed for:', origin); // DEBUG
      callback(null, true);
    } else {
      console.log('❌ CORS blocked for:', origin); // DEBUG
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    body: req.method === 'POST' ? Object.keys(req.body) : undefined,
  });
  next();
});

// API Routes
app.use('/auth', authRoutes);
app.use('/files', fileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    allowedOrigins: allowedOrigins,
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Google Drive Clone API',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      files: '/files',
      health: '/health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {},
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║      Google Drive Clone Server                         ║
║   Environment: ${process.env.NODE_ENV || 'development'}
║   Port: ${PORT}
║   Allowed Origins:
║   ${allowedOrigins.map(o => `  - ${o}`).join('\n║   ')}
╚════════════════════════════════════════════════════════╝
  `);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

module.exports = app;