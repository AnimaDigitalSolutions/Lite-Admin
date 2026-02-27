import { Router } from 'express';
import adminAuth from '../middleware/adminAuth.js';
import { uploadSingle, requireFile } from '../middleware/upload.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { 
  mediaUploadSchema, 
  mediaUpdateSchema, 
  mediaIdSchema,
  mediaListQuerySchema 
} from '../schemas/media.js';
import { contactListQuerySchema, contactIdSchema } from '../schemas/contact.js';
import { waitlistListQuerySchema } from '../schemas/waitlist.js';
import contactService from '../services/forms/contact.js';
import waitlistService from '../services/forms/waitlist.js';
import DatabaseFactory from '../database/index.js';
import StorageFactory from '../services/storage/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Apply admin auth to all routes
router.use(adminAuth);

// Initialize services
let db;
let storage;

const initServices = async () => {
  if (!db) db = await DatabaseFactory.create(config.database.type);
  if (!storage) storage = await StorageFactory.create(config.storage.provider);
  await storage.initialize();
};

// === MEDIA MANAGEMENT ===

// Upload portfolio image
router.post('/media/upload',
  uploadSingle('image'),
  requireFile,
  validateBody(mediaUploadSchema),
  async (req, res, next) => {
    try {
      await initServices();
      
      const file = req.file;
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
      
      logger.info('Admin uploaded media', {
        id: savedMedia.id,
        filename: savedMedia.filename,
      });
      
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
      await initServices();
      
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
      await initServices();
      
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
      
      logger.info('Admin deleted media', {
        id: req.validatedParams.id,
        filename: media.filename,
      });
      
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
        { ip: req.ip }
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
      await initServices();
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
      await initServices();
      
      // Get counts
      const [contacts, waitlist, media] = await Promise.all([
        db.contacts.findAll(1, 0),
        db.waitlist.findAll(1, 0),
        db.media.findAll(1, 0),
      ]);
      
      const stats = {
        contacts: {
          total: contacts.length, // In production, add COUNT query
          recent: contacts[0]?.submitted_at,
        },
        waitlist: {
          total: waitlist.length, // In production, add COUNT query
          recent: waitlist[0]?.signed_up_at,
        },
        media: {
          total: media.length, // In production, add COUNT query
          recent: media[0]?.uploaded_at,
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