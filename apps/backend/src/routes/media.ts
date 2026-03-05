/// <reference path="../types/express.d.ts" />
import { Router } from 'express';
import { validateQuery, validateParams } from '../middleware/validation.js';
import { mediaListQuerySchema, mediaIdSchema, thumbnailQuerySchema } from '../schemas/media.js';
import DatabaseService from '../services/database.service.js';
import StorageFactory from '../services/storage/index.js';
import type LocalStorageProvider from '../services/storage/providers/local.js';
import type S3StorageProvider from '../services/storage/providers/s3.js';
import config from '../config/index.js';
import sharp from 'sharp';

const router = Router();

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

// Get portfolio media list
router.get('/portfolio',
  validateQuery(mediaListQuerySchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { storage } = await initServices();
      
      const { limit, offset, project } = req.validatedQuery;
      const media = await db.media.findAll(limit, offset);
      
      // Filter by project if specified
      const filtered = project 
        ? media.filter(item => item.project_name === project)
        : media;
      
      // Add public URLs
      const mediaWithUrls = filtered.map(item => ({
        ...item,
        url: `/uploads/portfolio/${item.filename}`,
        thumbnailUrl: storage.getThumbnailUrl(item.storage_path || item.filename),
      }));
      
      res.json({
        data: mediaWithUrls,
        pagination: {
          limit,
          offset,
          total: mediaWithUrls.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get specific media item
router.get('/:id',
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
      
      // Serve the file
      const signedUrl = await storage.getSignedUrl(media.storage_path);
      res.redirect(signedUrl);
    } catch (error) {
      next(error);
    }
  }
);

// Get optimized thumbnail
router.get('/:id/thumb',
  validateParams(mediaIdSchema),
  validateQuery(thumbnailQuerySchema),
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
      
      const {
        width = config.image.thumbnail.width,
        height = config.image.thumbnail.height,
        quality = config.image.quality,
      } = req.validatedQuery;
      
      // Get the image buffer
      let imageBuffer;
      if (storage.provider === 'local') {
        imageBuffer = await storage.download(media.storage_path);
      } else {
        imageBuffer = await storage.download(media.storage_path);
      }
      
      // Generate optimized thumbnail on the fly
      const thumbnail = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality })
        .toBuffer();
      
      // Set cache headers
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000', // 1 year
        'ETag': `"${media.id}-${width}x${height}-q${quality}"`,
      });
      
      res.send(thumbnail);
    } catch (error) {
      next(error);
    }
  }
);

export default router;