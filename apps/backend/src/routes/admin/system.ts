/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import DatabaseService from '../../services/database.service.js';

const router = Router();

// Database migrations
router.post('/migrate',
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      await db.migrate();

      await db.adminLogs.create({
        action: 'database_migration',
        resource: 'system',
        details: 'Ran database migrations',
        ip_address: req.ip,
      });

      res.json({
        success: true,
        message: 'Migrations completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// System statistics
router.get('/stats',
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();

      const days = Math.min(Math.max(parseInt(String(req.query['days'] || '30'), 10) || 30, 1), 365);

      const [
        contactCount, waitlistCount, mediaCount,
        recentContacts, recentWaitlist, recentMedia,
        contactTrend, waitlistTrend,
      ] = await Promise.all([
        db.contacts.count(),
        db.waitlist.count(),
        db.media.count(),
        db.contacts.findAll(1, 0),
        db.waitlist.findAll(1, 0),
        db.media.findAll(1, 0),
        db.contacts.dailyCounts(days),
        db.waitlist.dailyCounts(days),
      ]);

      const stats = {
        contacts: {
          total: contactCount,
          recent: recentContacts[0]?.submitted_at,
          trend: contactTrend,
        },
        waitlist: {
          total: waitlistCount,
          recent: recentWaitlist[0]?.signed_up_at,
          trend: waitlistTrend,
        },
        media: {
          total: mediaCount,
          recent: recentMedia[0]?.uploaded_at,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          node_version: process.version,
        },
      };

      res.json({
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
