import { Router } from 'express';
import authRouter from './auth.js';
import formsRouter from './forms.js';
import mediaRouter from './media.js';
import adminRouter from './admin/index.js';
import healthRouter from './health.js';
import { generalRateLimiter, formsRateLimiter } from '../middleware/smartRateLimit.js';

const router = Router();

// Mount route groups with appropriate rate limiting
router.use('/auth', generalRateLimiter, authRouter);
router.use('/forms', formsRateLimiter, formsRouter);
router.use('/media', generalRateLimiter, mediaRouter);
router.use('/admin', adminRouter); // Admin routes have their own auth
router.use('/health', healthRouter); // Health checks bypass rate limiting

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Lite Backend API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /auth/login',
        refresh: 'POST /auth/refresh',
        logout: 'POST /auth/logout',
        me: 'GET /auth/me',
      },
      forms: {
        contact: 'POST /forms/contact',
        waitlist: 'POST /forms/waitlist',
      },
      media: {
        portfolio: 'GET /media/portfolio',
        item: 'GET /media/:id',
        thumbnail: 'GET /media/:id/thumb',
      },
      admin: {
        media: {
          upload: 'POST /admin/media/upload',
          update: 'PUT /admin/media/:id',
          delete: 'DELETE /admin/media/:id',
        },
        submissions: {
          list: 'GET /admin/submissions',
          delete: 'DELETE /admin/submission/:id',
        },
        waitlist: {
          list: 'GET /admin/waitlist',
          export: 'GET /admin/waitlist/export',
        },
        system: {
          migrate: 'POST /admin/migrate',
          stats: 'GET /admin/stats',
        },
      },
    },
  });
});

export default router;