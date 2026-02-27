import { Router } from 'express';
import { validateBody } from '../middleware/validation.js';
import { strictLimiter } from '../middleware/rateLimit.js';
import { contactSchema } from '../schemas/contact.js';
import { waitlistSchema } from '../schemas/waitlist.js';
import contactService from '../services/forms/contact.js';
import waitlistService from '../services/forms/waitlist.js';

const router = Router();

// Contact form submission
router.post('/contact', 
  strictLimiter,
  validateBody(contactSchema),
  async (req, res, next) => {
    try {
      const result = await contactService.processSubmission(
        req.validatedBody,
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
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
  validateBody(waitlistSchema),
  async (req, res, next) => {
    try {
      const result = await waitlistService.addToWaitlist(
        req.validatedBody,
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }
      );
      
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;