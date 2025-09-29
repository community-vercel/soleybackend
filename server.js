const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const foodItemRoutes = require('./routes/fooditems');
const orderRoutes = require('./routes/orderRoutes');
// const branchRoutes = require('./routes/branches');
const setting = require('./routes/settings');
const offers = require('./routes/offer');


// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/not-found');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// Data sanitization against XSS
app.use((req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  next();
});

// Compression middleware
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});


app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/user', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/food-items', foodItemRoutes);
app.use('/api/v1/orders', orderRoutes);
// app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/settings', setting);
app.use('/api/v1/offer', offers);
// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {});
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up indexes for better performance
    await setupIndexes();
    
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};
// Setup database indexes
const setupIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ phone: 1 });
    
    // Food items collection indexes
    await db.collection('fooditems').createIndex({ name: 'text', description: 'text' });
    await db.collection('fooditems').createIndex({ category: 1 });
    await db.collection('fooditems').createIndex({ isActive: 1 });
    await db.collection('fooditems').createIndex({ isFeatured: 1 });
    await db.collection('fooditems').createIndex({ isPopular: 1 });
    
    // Orders collection indexes
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    await db.collection('orders').createIndex({ branchId: 1 });
    
    // Categories collection indexes
    await db.collection('categories').createIndex({ isActive: 1 });
    await db.collection('categories').createIndex({ sortOrder: 1 });
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
};



function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
}

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Connect to MongoDB
connectDB();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;