import { Router } from 'express';
import adminAuth from '../../middleware/adminAuth.js';
import mediaRouter from './media.js';
import contactsRouter from './contacts.js';
import waitlistRouter from './waitlist.js';
import campaignsRouter from './campaigns.js';
import invoicesRouter from './invoices.js';
import settingsRouter from './settings.js';
import systemRouter from './system.js';
import sitesRouter from './sites.js';
import emailRouter from './email.js';
import logsRouter from './logs.js';

const router = Router();

// Apply admin auth to all routes
router.use(adminAuth);

// Mount domain sub-routers
router.use(mediaRouter);
router.use(contactsRouter);
router.use(waitlistRouter);
router.use(campaignsRouter);
router.use(invoicesRouter);
router.use(settingsRouter);
router.use(systemRouter);
router.use(sitesRouter);
router.use(emailRouter);
router.use(logsRouter);

export default router;
