import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
}

const createRateLimiter = (options: RateLimitOptions = {}) => {
  const defaultOptions = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
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
    skip: (req: Request) => {
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