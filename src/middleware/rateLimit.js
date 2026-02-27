import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn({
        message: 'Rate limit exceeded',
        ip: req.ip,
        url: req.url,
        userAgent: req.get('user-agent'),
      });
      
      res.status(429).json({
        error: {
          message: options.message || 'Too many requests from this IP, please try again later.',
          status: 429,
          retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        },
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Different rate limiters for different endpoints
export const defaultLimiter = createRateLimiter();

export const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many requests, please try again after 15 minutes.',
});

export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'API rate limit exceeded.',
});

export default defaultLimiter;