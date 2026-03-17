/// <reference path="../types/express.d.ts" />
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { validateBody } from '../middleware/validation.js';
import { contactSchema } from '../schemas/contact.js';
import { waitlistSchema } from '../schemas/waitlist.js';
import contactService from '../services/forms/contact.js';
import waitlistService from '../services/forms/waitlist.js';
import SettingsService from '../services/settings/index.js';
import DatabaseService from '../services/database.service.js';

const router = Router();

// Maintenance mode guard
const checkMaintenance: RequestHandler = async (_req, res, next) => {
  const settings = await SettingsService.getInstance();
  if (settings.isMaintenanceMode()) {
    res.status(503).json({
      error: {
        message: settings.getMaintenanceMessage(),
        status: 503,
      },
    });
    return;
  }
  next();
};

// X-Site-Key validation — required for all form submissions
// Validates the key, checks endpoint permissions, and attaches site_id to the request
function requireSiteKey(scope: string): RequestHandler {
  return async (req, res, next) => {
    const key = req.headers['x-site-key'];
    if (!key) {
      res.status(401).json({ error: { message: 'Missing X-Site-Key header', status: 401 } });
      return;
    }
    const db = await DatabaseService.getInstance();
    const site = await db.sites.findByKey(key as string);
    if (!site) {
      res.status(401).json({ error: { message: 'Invalid or inactive site key', status: 401 } });
      return;
    }
    const permissions = (site.permissions ?? 'contact,waitlist').split(',').map(s => s.trim());
    if (!permissions.includes(scope)) {
      res.status(403).json({ error: { message: `Site key not authorized for: ${scope}`, status: 403 } });
      return;
    }
    res.locals['siteId'] = site.id;
    next();
  };
}

// Contact form submission
router.post('/contact',
  checkMaintenance,
  requireSiteKey('contact'),
  validateBody(contactSchema),
  async (req, res, next) => {
    try {
      const result = await contactService.processSubmission(
        req.validatedBody,
        {
          ip: req.ip || 'unknown',
          userAgent: req.get('user-agent'),
          siteId: res.locals['siteId'] as number | undefined,
        }
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Waitlist signup
router.post('/waitlist',
  checkMaintenance,
  requireSiteKey('waitlist'),
  validateBody(waitlistSchema),
  async (req, res, next) => {
    try {
      const result = await waitlistService.addToWaitlist(
        req.validatedBody,
        {
          ip: req.ip || 'unknown',
          userAgent: req.get('user-agent'),
          siteId: res.locals['siteId'] as number | undefined,
        }
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;