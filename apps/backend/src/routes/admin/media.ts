/// <reference path="../../types/express.d.ts" />
import path from 'path';
import { Router } from 'express';
import { uploadSingle, requireFile } from '../../middleware/upload.js';
import { validateBody, validateParams } from '../../middleware/validation.js';
import {
  mediaUploadSchema,
  mediaUpdateSchema,
  mediaIdSchema
} from '../../schemas/media.js';
import {
  mediaRenameSchema,
  mediaBulkDownloadSchema
} from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';
import StorageFactory from '../../services/storage/index.js';
import type LocalStorageProvider from '../../services/storage/providers/local.js';
import type S3StorageProvider from '../../services/storage/providers/s3.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

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

// Upload portfolio media (images, videos, PDFs)
router.post('/media/upload',
  uploadSingle('file'),
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
        filename: path.basename(uploadResult.path),
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

// Rename media file
router.patch('/media/:id/rename',
  validateParams(mediaIdSchema),
  validateBody(mediaRenameSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { storage } = await initServices();

      const { name } = req.validatedBody;

      const media = await db.media.findById(req.validatedParams.id);
      if (!media) {
        return res.status(404).json({ error: { message: 'Media not found', status: 404 } });
      }

      // Only local storage supports rename right now
      if (storage.provider !== 'local') {
        return res.status(400).json({ error: { message: 'Rename only supported for local storage', status: 400 } });
      }

      const localStorage = storage as LocalStorageProvider;
      const newPath = await localStorage.rename(media.storage_path, name);
      const newFilename = path.basename(newPath);

      await db.media.updateById(req.validatedParams.id, {
        filename: newFilename,
        original_name: name.trim(),
      });

      await db.adminLogs.create({
        action: 'media_rename',
        resource: 'portfolio_media',
        resource_id: req.validatedParams.id,
        details: `Renamed ${media.original_name} → ${name.trim()}`,
        ip_address: req.ip,
      });

      res.json({
        success: true,
        data: { filename: newFilename, original_name: name.trim() },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk download as ZIP
router.post('/media/bulk-download',
  validateBody(mediaBulkDownloadSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { ids } = req.validatedBody;

      const items = await Promise.all(
        (ids as string[]).map(id => db.media.findById(Number(id)))
      );
      const found = items.filter(Boolean) as NonNullable<(typeof items)[number]>[];

      if (found.length === 0) {
        return res.status(404).json({ error: { message: 'No media found for given IDs', status: 404 } });
      }

      const archiver = (await import('archiver')).default;
      const archive = archiver('zip', { zlib: { level: 6 } });

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="media-${Date.now()}.zip"`,
      });

      archive.pipe(res);
      archive.on('error', (err) => next(err));

      for (const item of found) {
        archive.file(item.storage_path, { name: item.original_name || item.filename });
      }

      await archive.finalize();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
