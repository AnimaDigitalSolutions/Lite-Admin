/// <reference path="../types/express.d.ts" />
import { Router } from 'express';
import adminAuth from '../middleware/adminAuth.js';
import { uploadSingle, requireFile } from '../middleware/upload.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { 
  mediaUploadSchema, 
  mediaUpdateSchema, 
  mediaIdSchema
} from '../schemas/media.js';
import { contactListQuerySchema, contactIdSchema, contactTestEmailSchema } from '../schemas/contact.js';
import { waitlistListQuerySchema, waitlistTestEmailSchema } from '../schemas/waitlist.js';
import contactService from '../services/forms/contact.js';
import waitlistService from '../services/forms/waitlist.js';
import DatabaseService from '../services/database.service.js';
import StorageFactory from '../services/storage/index.js';
import type LocalStorageProvider from '../services/storage/providers/local.js';
import type S3StorageProvider from '../services/storage/providers/s3.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Apply admin auth to all routes
router.use(adminAuth);

// Initialize services
let storage: LocalStorageProvider | S3StorageProvider | undefined;

const initServices = async (): Promise<{ 
  storage: LocalStorageProvider | S3StorageProvider 
}> => {
  if (!storage) {
    storage = await StorageFactory.create(config.storage.provider);
    await storage.initialize();
  }
  return { storage };
};

// === MEDIA MANAGEMENT ===

// Upload portfolio image
router.post('/media/upload',
  uploadSingle('image'),
  requireFile,
  validateBody(mediaUploadSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { storage } = await initServices();
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          error: {
            message: 'No file provided',
            status: 400,
          },
        });
      }
      
      const { project_name, description } = req.validatedBody;
      
      // Upload file to storage
      const uploadResult = await storage.upload(file, 'portfolio');
      
      // Get image metadata if available
      const mediaData = {
        filename: file.originalname,
        original_name: file.originalname,
        project_name,
        description,
        file_size: file.size,
        width: uploadResult.metadata?.originalWidth,
        height: uploadResult.metadata?.originalHeight,
        mime_type: file.mimetype,
        storage_provider: uploadResult.provider,
        storage_path: uploadResult.path,
      };
      
      // Save to database
      const savedMedia = await db.media.create(mediaData);
      
      // Log activity
      await db.adminLogs.create({
        action: 'media_upload',
        resource: 'portfolio_media',
        resource_id: savedMedia.id,
        details: `Uploaded ${file.originalname}`,
        ip_address: req.ip,
      });
      
      logger.info({
        id: savedMedia.id,
        filename: savedMedia.filename,
      }, 'Admin uploaded media');
      
      res.status(201).json({
        success: true,
        data: {
          ...savedMedia,
          url: uploadResult.url,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update media metadata
router.put('/media/:id',
  validateParams(mediaIdSchema),
  validateBody(mediaUpdateSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      
      const updated = await db.media.updateById(
        req.validatedParams.id,
        req.validatedBody
      );
      
      if (!updated) {
        return res.status(404).json({
          error: {
            message: 'Media not found',
            status: 404,
          },
        });
      }
      
      // Log activity
      await db.adminLogs.create({
        action: 'media_update',
        resource: 'portfolio_media',
        resource_id: req.validatedParams.id,
        details: 'Updated media metadata',
        ip_address: req.ip,
      });
      
      res.json({
        success: true,
        message: 'Media updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete media
router.delete('/media/:id',
  validateParams(mediaIdSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { storage } = await initServices();
      
      const media = await db.media.findById(req.validatedParams.id);
      
      if (!media) {
        return res.status(404).json({
          error: {
            message: 'Media not found',
            status: 404,
          },
        });
      }
      
      // Delete from storage
      await storage.delete(media.storage_path);
      
      // Delete from database
      await db.media.deleteById(req.validatedParams.id);
      
      // Log activity
      await db.adminLogs.create({
        action: 'media_delete',
        resource: 'portfolio_media',
        resource_id: req.validatedParams.id,
        details: `Deleted ${media.filename}`,
        ip_address: req.ip,
      });
      
      logger.info({
        id: req.validatedParams.id,
        filename: media.filename,
      }, 'Admin deleted media');
      
      res.json({
        success: true,
        message: 'Media deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// === FORM DATA MANAGEMENT ===

// Get all contact submissions
router.get('/submissions',
  validateQuery(contactListQuerySchema),
  async (req, res, next) => {
    try {
      const { limit, offset } = req.validatedQuery;
      const submissions = await contactService.getSubmissions({ limit, offset });
      
      res.json({
        data: submissions,
        pagination: {
          limit,
          offset,
          total: submissions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete contact submission
router.delete('/submission/:id',
  validateParams(contactIdSchema),
  async (req, res, next) => {
    try {
      const result = await contactService.deleteSubmission(
        req.validatedParams.id,
        { ip: req.ip || 'unknown' }
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get waitlist entries
router.get('/waitlist',
  validateQuery(waitlistListQuerySchema),
  async (req, res, next) => {
    try {
      const { limit, offset } = req.validatedQuery;
      const entries = await waitlistService.getWaitlistEntries({ limit, offset });
      
      res.json({
        data: entries,
        pagination: {
          limit,
          offset,
          total: entries.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export waitlist as CSV
router.get('/waitlist/export',
  async (req, res, next) => {
    try {
      const exportData = await waitlistService.exportWaitlist();
      
      // Generate CSV
      const csvContent = [
        exportData.headers.join(','),
        ...exportData.rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');
      
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="waitlist-${new Date().toISOString().split('T')[0]}.csv"`,
      });
      
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }
);

// === SYSTEM ===

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
      
      // Get counts and recent entries
      const [contactCount, waitlistCount, mediaCount, recentContacts, recentWaitlist, recentMedia] = await Promise.all([
        db.contacts.count(),
        db.waitlist.count(),
        db.media.count(),
        db.contacts.findAll(1, 0),
        db.waitlist.findAll(1, 0), 
        db.media.findAll(1, 0),
      ]);
      
      const stats = {
        contacts: {
          total: contactCount,
          recent: recentContacts[0]?.submitted_at,
        },
        waitlist: {
          total: waitlistCount,
          recent: recentWaitlist[0]?.signed_up_at,
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

// === EMAIL TESTING ===

// Test contact form email
router.post('/test-email/contact',
  validateBody(contactTestEmailSchema),
  async (req, res, next) => {
    try {
      const { test_email, ...formData } = req.validatedBody;
      
      const result = await contactService.processTestSubmission(
        formData,
        test_email,
        { ip: req.ip || 'unknown' }
      );
      
      // Log admin activity  
      const db = await DatabaseService.getInstance();
      await db.adminLogs.create({
        action: 'email_test_contact',
        resource: 'system',
        details: `Sent test contact email to ${test_email}`,
        ip_address: req.ip,
      });
      
      logger.info({
        testEmail: test_email,
        success: result.success,
        emailSent: result.data.email_sent,
      }, 'Admin sent test contact email');
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Test waitlist confirmation email
router.post('/test-email/waitlist',
  validateBody(waitlistTestEmailSchema),
  async (req, res, next) => {
    try {
      const { test_email, ...formData } = req.validatedBody;
      
      const result = await waitlistService.addTestToWaitlist(
        test_email,
        formData,
        { ip: req.ip || 'unknown' }
      );
      
      // Log admin activity
      const db = await DatabaseService.getInstance();
      await db.adminLogs.create({
        action: 'email_test_waitlist',
        resource: 'system', 
        details: `Sent test waitlist email to ${test_email}`,
        ip_address: req.ip,
      });
      
      logger.info({
        testEmail: test_email,
        success: result.success,
        emailSent: result.data.email_sent,
      }, 'Admin sent test waitlist email');
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;