/// <reference path="../types/express.d.ts" />
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { validateBody } from '../middleware/validation.js';
import { strictLimiter } from '../middleware/rateLimit.js';
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

// X-Site-Key validation — optional, backward compatible
// If provided, validates the key and attaches site_id to the request
const validateSiteKey: RequestHandler = async (req, res, next) => {
  const key = req.headers['x-site-key'];
  if (!key) {
    next();
    return;
  }
  const db = await DatabaseService.getInstance();
  const site = await db.sites.findByKey(key as string);
  if (!site) {
    res.status(401).json({ error: { message: 'Invalid or inactive site key', status: 401 } });
    return;
  }
  res.locals['siteId'] = site.id; // passed to route handlers via res.locals
  next();
};

// Contact form submission
router.post('/contact',
  strictLimiter,
  checkMaintenance,
  validateSiteKey,
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
  strictLimiter,
  checkMaintenance,
  validateSiteKey,
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