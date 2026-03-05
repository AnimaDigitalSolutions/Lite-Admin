import { Router } from 'express';
import { authService } from '../services/auth/auth.service.js';
import { loginSchema, refreshTokenSchema } from '@lite/shared';
import { authenticate } from '../middleware/auth.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    
    // Perform login
    const result = await authService.login(validatedData);
    
    // Set cookies for web dashboard
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      path: '/api/auth/refresh', // Restrict refresh token to refresh endpoint
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    // Send response with tokens and user data
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get refresh token from cookie first, then body
    let refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken && req.body) {
      const validated = refreshTokenSchema.safeParse(req.body);
      if (validated.success) {
        refreshToken = validated.data.refreshToken;
      }
    }
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Refresh token required',
          status: 401,
        },
      });
    }
    
    // Generate new tokens
    const result = await authService.refreshTokens(refreshToken);
    
    // Update cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    
    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    // Send response with new tokens and user data
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Logout endpoint (optional - mainly for client-side token cleanup)
router.post('/logout', (req: Request, res: Response) => {
  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Get current user endpoint (requires authentication)
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // User data is attached to request by auth middleware
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;