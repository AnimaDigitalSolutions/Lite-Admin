import { Router } from 'express';
import formsRouter from './forms.js';
import mediaRouter from './media.js';
import adminRouter from './admin.js';
import healthRouter from './health.js';

const router = Router();

// Mount route groups
router.use('/forms', formsRouter);
router.use('/media', mediaRouter);
router.use('/admin', adminRouter);
router.use('/health', healthRouter);

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Lite Backend API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
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