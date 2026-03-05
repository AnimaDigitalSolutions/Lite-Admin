import type { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/auth/jwt.service.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '@lite/shared';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      isAdmin?: boolean;
    }
  }
}

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and attaches user data to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from cookie first, then Authorization header
    let token: string | undefined;
    
    // Try cookie first (for web dashboard)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } 
    // Fall back to Authorization header (for API access)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    
    if (!token) {
      logger.warn({
        message: 'Access attempted without valid authentication',
        ip: req.ip,
        url: req.url,
      });
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authorization required',
          status: 401,
        },
      });
    }
    
    try {
      // Verify token
      const payload = jwtService.verifyAccessToken(token);
      
      // Attach user data to request
      req.user = payload;
      req.isAdmin = payload.role === 'admin' || payload.role === 'super_admin';
      
      logger.info({
        message: 'Authenticated request',
        userId: payload.id,
        email: payload.email,
        ip: req.ip,
        url: req.url,
      });
      
      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Token expired') {
          logger.warn({
            message: 'Access attempted with expired token',
            ip: req.ip,
            url: req.url,
          });
          
          return res.status(401).json({
            success: false,
            error: {
              message: 'Token expired',
              status: 401,
              code: 'TOKEN_EXPIRED',
            },
          });
        }
        
        logger.warn({
          message: 'Access attempted with invalid token',
          error: error.message,
          ip: req.ip,
          url: req.url,
        });
      }
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          status: 401,
        },
      });
    }
  } catch (error) {
    logger.error({
      message: 'Authentication middleware error',
      error,
      ip: req.ip,
      url: req.url,
    });
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Authentication error',
        status: 500,
      },
    });
  }
};

/**
 * Admin-only Authentication Middleware
 * Requires both authentication and admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // First ensure user is authenticated
  await authenticate(req, res, () => {
    // Check if user has admin privileges
    if (!req.isAdmin) {
      logger.warn({
        message: 'Non-admin user attempted to access admin endpoint',
        userId: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
        ip: req.ip,
        url: req.url,
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Admin access required',
          status: 403,
        },
      });
    }
    
    next();
  });
};

/**
 * Optional Authentication Middleware
 * Attempts to authenticate but doesn't require it
 * Useful for endpoints that have different behavior for authenticated users
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const payload = jwtService.verifyAccessToken(token);
      req.user = payload;
      req.isAdmin = payload.role === 'admin' || payload.role === 'super_admin';
    } catch (error) {
      // Ignore authentication errors for optional auth
      logger.debug({
        message: 'Optional auth failed, continuing as anonymous',
        error,
        ip: req.ip,
        url: req.url,
      });
    }
  }
  
  next();
};