import express from 'express';
import helmet from 'helmet';
import corsMiddleware from './middleware/cors.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import defaultLimiter from './middleware/rateLimit.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(corsMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info({ 
    method: req.method, 
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Rate limiting
app.use('/api', defaultLimiter);

// Static files
app.use('/uploads', express.static('src/public/uploads'));

// API routes
app.use('/api', routes);

// Root health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  };
  
  res.status(200).json(health);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      status: 404,
      path: req.path,
    },
  });
});

// Global error handler
app.use(errorHandler);

export default app;