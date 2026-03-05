import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Trusted origins that get higher rate limits
const trustedOrigins = config.cors.origins;

// Different rate limit configurations
const rateLimitConfigs = {
  // Strict limits for unknown origins
  public: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: config.env === 'development' ? 1000 : 10, // Relaxed in dev
    message: 'Too many requests from this IP, please try again later.',
  },
  // Relaxed limits for trusted origins
  trusted: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: config.env === 'development' ? 1000 : 100, // Relaxed in dev
    message: 'Too many requests from this IP, please try again later.',
  },
  // Very strict limits for forms
  forms: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: config.env === 'development' ? 100 : 5, // Relaxed in dev
    message: 'Too many form submissions, please try again later.',
  },
  // Admin endpoints (after authentication)
  admin: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
    message: 'Too many requests from this IP, please try again later.',
  },
};

/**
 * Common skip logic for rate limiters
 */
function shouldSkipRateLimit(req: Request): boolean {
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }
  
  // Skip in development if bypass is enabled
  if (config.env === 'development' && process.env.RATE_LIMIT_BYPASS_DEV === 'true') {
    return true;
  }
  
  return false;
}

/**
 * Common rate limit handler
 */
function handleRateLimit(req: Request, res: Response, type: string) {
  const configKey = type as keyof typeof rateLimitConfigs;
  const limitConfig = rateLimitConfigs[configKey] || rateLimitConfigs.public;
  
  logger.warn({
    message: 'Rate limit exceeded',
    ip: req.ip,
    url: req.url,
    origin: req.get('origin'),
    referer: req.get('referer'),
    userAgent: req.get('user-agent'),
    type,
  });
  
  res.status(429).json({
    success: false,
    error: {
      message: limitConfig.message,
      status: 429,
      retryAfter: res.getHeader('Retry-After'),
    },
  });
}

// Create singleton rate limiter instances at startup
const rateLimiters = {
  public: rateLimit({
    ...rateLimitConfigs.public,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => handleRateLimit(req, res, 'public'),
    skip: (req) => shouldSkipRateLimit(req),
  }),
  trusted: rateLimit({
    ...rateLimitConfigs.trusted,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => handleRateLimit(req, res, 'trusted'),
    skip: (req) => shouldSkipRateLimit(req),
  }),
  forms: rateLimit({
    ...rateLimitConfigs.forms,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => handleRateLimit(req, res, 'forms'),
    skip: (req) => shouldSkipRateLimit(req),
  }),
  admin: rateLimit({
    ...rateLimitConfigs.admin,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => handleRateLimit(req, res, 'admin'),
    skip: (req) => shouldSkipRateLimit(req),
  }),
};

/**
 * Determines if the request origin is trusted
 */
function isTrustedOrigin(req: Request): boolean {
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  // Check origin header
  if (origin && trustedOrigins.includes(origin)) {
    return true;
  }
  
  // Check referer as fallback
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (trustedOrigins.includes(refererOrigin)) {
        return true;
      }
    } catch {
      // Invalid referer URL, ignore
    }
  }
  
  return false;
}

/**
 * Selects the appropriate rate limiter based on request context
 */
function selectRateLimiter(req: Request, type: 'general' | 'forms' = 'general') {
  // Admin users get the highest limits (check if user is authenticated as admin)
  if (req.user?.role === 'super_admin' || req.user?.role === 'admin') {
    return rateLimiters.admin;
  }
  
  // Form endpoints always get strict limits
  if (type === 'forms') {
    return rateLimiters.forms;
  }
  
  // Trusted origins get relaxed limits
  if (isTrustedOrigin(req)) {
    return rateLimiters.trusted;
  }
  
  // Default to public limits
  return rateLimiters.public;
}

/**
 * Creates a smart rate limiter that selects the appropriate limiter instance
 */
export function createSmartRateLimiter(type: 'general' | 'forms' = 'general') {
  return (req: Request, res: Response, next: NextFunction) => {
    const limiter = selectRateLimiter(req, type);
    limiter(req, res, next);
  };
}

/**
 * Middleware to detect and block suspicious activity
 */
export function suspiciousActivityBlocker(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.get('user-agent')?.toLowerCase() || '';
  const path = req.path.toLowerCase();
  
  // Block common scanning patterns (but allow our legitimate /api/admin routes)
  const suspiciousPatterns = [
    /\.(php|asp|aspx|jsp|cgi)$/i,
    /\/(wp-admin|wp-content|wordpress)/i,
    /^\/(?!api\/admin\/).*\/(admin|administrator|phpmyadmin)/i, // Allow /api/admin but block other admin paths
    /\/(\.git|\.env|\.config)/i,
    /\/(etc\/passwd|proc\/self)/i,
  ];
  
  // Block suspicious user agents
  const suspiciousAgents = [
    'sqlmap',
    'nikto',
    'scanner',
    'nmap',
    'havij',
    'acunetix',
  ];
  
  // Check for suspicious patterns in the path
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path)) {
      logger.warn({
        message: 'Blocked suspicious path pattern',
        ip: req.ip,
        path: req.path,
        userAgent,
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden',
          status: 403,
        },
      });
    }
  }
  
  // Check for suspicious user agents
  for (const agent of suspiciousAgents) {
    if (userAgent.includes(agent)) {
      logger.warn({
        message: 'Blocked suspicious user agent',
        ip: req.ip,
        userAgent,
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden',
          status: 403,
        },
      });
    }
  }
  
  next();
}

// Pre-configured rate limiters for easy import
export const generalRateLimiter = createSmartRateLimiter('general');
export const formsRateLimiter = createSmartRateLimiter('forms');

// Direct access to specific limiters if needed
export { rateLimiters };