/// <reference path="../types/express.d.ts" />
import path from 'path';
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
import { randomBytes } from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import SettingsService from '../services/settings/index.js';
import EmailFactory from '../services/email/index.js';

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
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { storage } = await initServices();

      const { name } = req.body as { name?: string };
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: { message: 'name is required', status: 400 } });
      }

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
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { ids } = req.body as { ids?: unknown };

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: { message: 'ids array is required', status: 400 } });
      }

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

// Update contact submission (editable fields only)
router.patch('/submissions/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { name, email, company, project_type, message } = req.body as {
      name?: string; email?: string; company?: string; project_type?: string; message?: string;
    };

    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ error: { message: 'Invalid email address', status: 422 } });
    }

    const data: Record<string, string | undefined> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (company !== undefined) data.company = company;
    if (project_type !== undefined) data.project_type = project_type;
    if (message !== undefined) data.message = message;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: { message: 'No fields to update', status: 400 } });
    }

    const db = await DatabaseService.getInstance();
    const updated = await db.contacts.updateById(id, data);
    if (!updated) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    await db.adminLogs.create({
      action: 'contact_update',
      resource: 'contacts',
      details: `Updated contact #${id}: ${Object.keys(data).join(', ')}`,
      ip_address: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

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

// Update waitlist/subscriber entry (editable fields only)
router.patch('/waitlist/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { name, email, tags } = req.body as { name?: string; email?: string; tags?: string };

    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ error: { message: 'Invalid email address', status: 422 } });
    }

    const data: Record<string, string | undefined> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (tags !== undefined) data.tags = tags;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: { message: 'No fields to update', status: 400 } });
    }

    const db = await DatabaseService.getInstance();
    const updated = await db.waitlist.updateById(id, data);
    if (!updated) return res.status(404).json({ error: { message: 'Subscriber not found', status: 404 } });

    await db.adminLogs.create({
      action: 'waitlist_update',
      resource: 'waitlist',
      details: `Updated subscriber #${id}: ${Object.keys(data).join(', ')}`,
      ip_address: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

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

// === SETTINGS ===

// Get all settings
router.get('/settings',
  async (_req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const all = settingsService.getAll();

      res.json({
        data: {
          email_enabled: all['email_enabled'] !== 'false',
          maintenance_mode: all['maintenance_mode'] === 'true',
          maintenance_message: all['maintenance_message'] ?? '',
          display_timezone: all['display_timezone'] ?? 'UTC',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update settings
router.put('/settings',
  async (req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const db = await DatabaseService.getInstance();
      const { email_enabled, maintenance_mode, maintenance_message, display_timezone } = req.body as {
        email_enabled?: boolean;
        maintenance_mode?: boolean;
        maintenance_message?: string;
        display_timezone?: string;
      };

      if (typeof email_enabled === 'boolean') {
        await settingsService.set('email_enabled', String(email_enabled));
      }
      if (typeof maintenance_mode === 'boolean') {
        await settingsService.set('maintenance_mode', String(maintenance_mode));
      }
      if (typeof maintenance_message === 'string') {
        await settingsService.set('maintenance_message', maintenance_message);
      }
      if (typeof display_timezone === 'string' && display_timezone) {
        await settingsService.set('display_timezone', display_timezone);
      }

      await db.adminLogs.create({
        action: 'settings_update',
        resource: 'system',
        details: 'Updated runtime settings',
        ip_address: req.ip,
      });

      const all = settingsService.getAll();
      res.json({
        success: true,
        data: {
          email_enabled: all['email_enabled'] !== 'false',
          maintenance_mode: all['maintenance_mode'] === 'true',
          maintenance_message: all['maintenance_message'] ?? '',
          display_timezone: all['display_timezone'] ?? 'UTC',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// === MENU CONFIGURATION ===

const NAV_KEYS = [
  'nav_visible_media',
  'nav_visible_contacts',
  'nav_visible_waitlist',
  'nav_visible_subscribers',
  'nav_visible_campaigns',
  'nav_visible_sites',
  'nav_visible_stats',
  'nav_visible_logs',
  'nav_visible_email',
  'nav_visible_email_templates',
  'nav_visible_users',
] as const;

// Get menu visibility preferences
router.get('/settings/menu',
  async (_req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const all = settingsService.getAll();

      const prefs: Record<string, boolean> = {};
      for (const key of NAV_KEYS) {
        prefs[key] = all[key] !== 'false'; // default true
      }

      res.json({ data: prefs });
    } catch (error) {
      next(error);
    }
  }
);

// Update menu visibility preferences
router.put('/settings/menu',
  async (req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const db = await DatabaseService.getInstance();
      const body = req.body as Record<string, boolean>;

      for (const key of NAV_KEYS) {
        if (typeof body[key] === 'boolean') {
          await settingsService.set(key, String(body[key]));
        }
      }

      await db.adminLogs.create({
        action: 'menu_config_update',
        resource: 'system',
        details: 'Updated menu visibility preferences',
        ip_address: req.ip,
      });

      // Return current state
      const all = settingsService.getAll();
      const prefs: Record<string, boolean> = {};
      for (const key of NAV_KEYS) {
        prefs[key] = all[key] !== 'false';
      }

      res.json({ success: true, data: prefs });
    } catch (error) {
      next(error);
    }
  }
);

// === ACTIVITY LOGS ===

router.get('/logs',
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const limit = Math.min(Number(req.query['limit']) || 50, 200);
      const offset = Number(req.query['offset']) || 0;

      const [logs, total] = await Promise.all([
        db.adminLogs.findAll(limit, offset),
        db.adminLogs.count(),
      ]);

      res.json({
        data: logs,
        pagination: { limit, offset, total },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a single log entry
router.delete('/logs/:id',
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const id = Number(req.params['id']);

      if (!id || isNaN(id)) {
        return res.status(400).json({ error: { message: 'Invalid log ID', status: 400 } });
      }

      const deleted = await db.adminLogs.deleteById(id);
      if (!deleted) {
        return res.status(404).json({ error: { message: 'Log entry not found', status: 404 } });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Clear all log entries
router.delete('/logs',
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const count = await db.adminLogs.deleteAll();
      res.json({ success: true, deleted: count });
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

// === SITES ===

const generateSiteKey = () => `lsk_${randomBytes(24).toString('hex')}`;

router.get('/sites', async (_req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const sites = await db.sites.findAll();
    res.json({ data: sites });
  } catch (error) { next(error); }
});

router.post('/sites', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { name, domain, description } = req.body as { name: string; domain?: string; description?: string };
    if (!name) return res.status(400).json({ error: { message: 'name is required', status: 400 } });

    const site = await db.sites.create({ name, domain, description, api_key: generateSiteKey(), is_active: true });
    await db.adminLogs.create({ action: 'site_create', resource: 'sites', resource_id: site.id, details: `Created site: ${name}`, ip_address: req.ip });
    res.status(201).json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.post('/sites/:id/regenerate', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    const newKey = generateSiteKey();
    const updated = await db.sites.updateApiKey(id, newKey);
    if (!updated) return res.status(404).json({ error: { message: 'Site not found', status: 404 } });

    await db.adminLogs.create({ action: 'site_key_regenerate', resource: 'sites', resource_id: id, details: 'API key regenerated', ip_address: req.ip });
    const site = await db.sites.findById(id);
    res.json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.patch('/sites/:id', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    const { is_active } = req.body as { is_active: boolean };
    if (typeof is_active === 'boolean') await db.sites.toggleActive(id, is_active);
    const site = await db.sites.findById(id);
    res.json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.delete('/sites/:id', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    const deleted = await db.sites.deleteById(id);
    if (!deleted) return res.status(404).json({ error: { message: 'Site not found', status: 404 } });
    await db.adminLogs.create({ action: 'site_delete', resource: 'sites', resource_id: id, details: 'Site deleted', ip_address: req.ip });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// === EMAIL TEMPLATES ===

// List all templates (DB override + file default)
router.get('/email-templates', async (_req, res, next) => {
  try {
    const settingsService = await SettingsService.getInstance();

    // Read default templates from filesystem
    const templatesDir = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../services/email/templates'
    );

    const templateNames = ['contact', 'waitlist'];
    const templates: Record<string, { name: string; default_html: string; custom_html: string | null; variables: string[] }> = {};

    const variableMap: Record<string, string[]> = {
      contact: ['name', 'email', 'company', 'project_type', 'message', 'date'],
      waitlist: ['name', 'email', 'date'],
    };

    const { readFile } = await import('fs/promises');

    for (const name of templateNames) {
      const filePath = path.join(templatesDir, `${name}.html`);
      const defaultHtml = await readFile(filePath, 'utf-8');
      const customHtml = settingsService.get(`email_template_${name}`) ?? null;

      templates[name] = {
        name,
        default_html: defaultHtml,
        custom_html: customHtml,
        variables: variableMap[name] || [],
      };
    }

    res.json({ data: templates });
  } catch (error) { next(error); }
});

// Update a template (save custom HTML to settings)
router.put('/email-templates/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const validNames = ['contact', 'waitlist'];
    if (!name || !validNames.includes(name)) {
      return res.status(400).json({ error: { message: `Invalid template name. Must be one of: ${validNames.join(', ')}`, status: 400 } });
    }

    const { html } = req.body as { html?: string };
    if (typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ error: { message: 'html is required', status: 400 } });
    }

    const settingsService = await SettingsService.getInstance();
    const db = await DatabaseService.getInstance();

    await settingsService.set(`email_template_${name}`, html);

    // Clear cached templates in the email provider
    EmailFactory.reset();

    await db.adminLogs.create({
      action: 'email_template_update',
      resource: 'system',
      details: `Updated email template: ${name}`,
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (error) { next(error); }
});

// Reset a template to file default
router.delete('/email-templates/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const validNames = ['contact', 'waitlist'];
    if (!name || !validNames.includes(name)) {
      return res.status(400).json({ error: { message: `Invalid template name. Must be one of: ${validNames.join(', ')}`, status: 400 } });
    }

    const settingsService = await SettingsService.getInstance();
    const db = await DatabaseService.getInstance();

    // Remove the custom override by setting to empty string
    await settingsService.set(`email_template_${name}`, '');

    EmailFactory.reset();

    await db.adminLogs.create({
      action: 'email_template_reset',
      resource: 'system',
      details: `Reset email template to default: ${name}`,
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (error) { next(error); }
});

// === PROVIDER CREDENTIALS ===

router.get('/credentials', async (_req, res, next) => {
  try {
    const settingsService = await SettingsService.getInstance();
    const overrides = settingsService.getAll();
    res.json({
      data: {
        email: {
          active_provider: overrides['email_provider'] ?? config.email.provider,
          ahasend_api_key: overrides['email_ahasend_api_key'] ?? config.email.ahasend?.apiKey ?? '',
          ahasend_account_id: overrides['email_ahasend_account_id'] ?? config.email.ahasend?.accountId ?? '',
          resend_api_key: overrides['email_resend_api_key'] ?? config.email.resend?.apiKey ?? '',
          from_address: overrides['email_from'] ?? config.email.from ?? '',
          display_name: overrides['email_display_name'] ?? 'Lite Admin',
          notification_address: overrides['email_notification_address'] ?? '',
        },
        storage: {
          active_provider: config.storage.provider,
          s3_access_key_id: overrides['storage_s3_access_key_id'] ?? config.storage.s3?.accessKeyId ?? '',
          s3_secret_access_key: overrides['storage_s3_secret_access_key'] ?? config.storage.s3?.secretAccessKey ?? '',
          s3_bucket: overrides['storage_s3_bucket'] ?? config.storage.s3?.bucket ?? '',
          s3_region: overrides['storage_s3_region'] ?? config.storage.s3?.region ?? '',
        },
      },
    });
  } catch (error) { next(error); }
});

router.put('/credentials', async (req, res, next) => {
  try {
    const settingsService = await SettingsService.getInstance();
    const db = await DatabaseService.getInstance();
    const { email, storage } = req.body as {
      email?: {
        active_provider?: string;
        ahasend_api_key?: string;
        ahasend_account_id?: string;
        resend_api_key?: string;
        from_address?: string;
        display_name?: string;
        notification_address?: string;
      };
      storage?: { s3_access_key_id?: string; s3_secret_access_key?: string; s3_bucket?: string; s3_region?: string };
    };

    let emailChanged = false;
    if (email) {
      if (typeof email.active_provider === 'string') { await settingsService.set('email_provider', email.active_provider); emailChanged = true; }
      if (typeof email.ahasend_api_key === 'string') { await settingsService.set('email_ahasend_api_key', email.ahasend_api_key); emailChanged = true; }
      if (typeof email.ahasend_account_id === 'string') { await settingsService.set('email_ahasend_account_id', email.ahasend_account_id); emailChanged = true; }
      if (typeof email.resend_api_key === 'string') { await settingsService.set('email_resend_api_key', email.resend_api_key); emailChanged = true; }
      if (typeof email.from_address === 'string') { await settingsService.set('email_from', email.from_address); emailChanged = true; }
      if (typeof email.display_name === 'string') { await settingsService.set('email_display_name', email.display_name); emailChanged = true; }
      if (typeof email.notification_address === 'string') { await settingsService.set('email_notification_address', email.notification_address); emailChanged = true; }
    }
    if (emailChanged) EmailFactory.reset();

    if (storage) {
      if (typeof storage.s3_access_key_id === 'string') await settingsService.set('storage_s3_access_key_id', storage.s3_access_key_id);
      if (typeof storage.s3_secret_access_key === 'string') await settingsService.set('storage_s3_secret_access_key', storage.s3_secret_access_key);
      if (typeof storage.s3_bucket === 'string') await settingsService.set('storage_s3_bucket', storage.s3_bucket);
      if (typeof storage.s3_region === 'string') await settingsService.set('storage_s3_region', storage.s3_region);
    }

    await db.adminLogs.create({ action: 'credentials_update', resource: 'system', details: 'Provider credentials updated', ip_address: req.ip });
    res.json({ success: true, email_provider_reset: emailChanged });
  } catch (error) { next(error); }
});

// === VERIFY API KEY ===

router.post('/credentials/verify-key', async (req, res, next) => {
  try {
    const { provider, api_key } = req.body as { provider: string; api_key: string };

    if (!provider || !api_key) {
      return res.status(400).json({ error: { message: 'provider and api_key are required', status: 400 } });
    }

    let valid = false;
    let errorMsg = '';

    try {
      if (provider === 'resend') {
        const resp = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        valid = resp.status === 200;
        if (!valid) errorMsg = `Resend returned status ${resp.status}`;
      } else if (provider === 'ahasend') {
        const resp = await fetch('https://api.ahasend.com/v2/ping', {
          headers: { Authorization: `Bearer ${api_key}` },
        });
        valid = resp.status === 200;
        if (!valid) errorMsg = `AhaSend returned status ${resp.status}`;
      } else {
        return res.status(400).json({ error: { message: `Unknown provider: ${provider}`, status: 400 } });
      }
    } catch (fetchErr) {
      errorMsg = (fetchErr as Error).message;
    }

    if (valid) {
      res.json({ valid: true });
    } else {
      res.status(422).json({ valid: false, error: errorMsg });
    }
  } catch (error) { next(error); }
});

// === MANUAL ENTRY CREATION ===

// Manually add a contact submission (admin only, no email notification)
router.post('/submissions', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { name, email, company, project_type, message } = req.body as {
      name: string;
      email: string;
      company?: string;
      project_type?: string;
      message: string;
    };

    if (!name || !email || !message) {
      return res.status(400).json({ error: { message: 'name, email, and message are required', status: 400 } });
    }

    const entry = await db.contacts.create({
      name,
      email: email.toLowerCase().trim(),
      company: company || undefined,
      project_type: project_type || undefined,
      message,
      ip_address: 'admin',
      user_agent: 'manual-entry',
      is_test: false,
    });

    await db.adminLogs.create({
      action: 'contact_manual_create',
      resource: 'contacts',
      resource_id: entry.id,
      details: `Manually added contact: ${email}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// Manually add a waitlist entry (admin only, no confirmation email)
router.post('/waitlist', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { email, name } = req.body as { email: string; name?: string };

    if (!email) {
      return res.status(400).json({ error: { message: 'email is required', status: 400 } });
    }

    const entry = await db.waitlist.create({
      email: email.toLowerCase().trim(),
      name: name || undefined,
      ip_address: 'admin',
      is_test: false,
    });

    await db.adminLogs.create({
      action: 'waitlist_manual_create',
      resource: 'waitlist',
      resource_id: entry.id,
      details: `Manually added to waitlist: ${email}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// === BULK DELETE ===

router.post('/submissions/bulk-delete', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { message: 'ids must be a non-empty array', status: 400 } });
    }
    const deleted = await db.contacts.deleteByIds(ids);
    await db.adminLogs.create({ action: 'contact_bulk_delete', resource: 'contacts', details: `Bulk deleted ${deleted} contact(s)`, ip_address: req.ip });
    res.json({ success: true, deleted });
  } catch (error) { next(error); }
});

router.post('/waitlist/bulk-delete', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { message: 'ids must be a non-empty array', status: 400 } });
    }
    const deleted = await db.waitlist.deleteByIds(ids);
    await db.adminLogs.create({ action: 'waitlist_bulk_delete', resource: 'waitlist', details: `Bulk deleted ${deleted} waitlist entry(s)`, ip_address: req.ip });
    res.json({ success: true, deleted });
  } catch (error) { next(error); }
});

// === CAMPAIGNS ===

// List all campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const limit = Math.min(Number(req.query['limit']) || 100, 200);
    const offset = Number(req.query['offset']) || 0;
    const campaigns = await db.campaigns.findAll(limit, offset);
    const total = await db.campaigns.count();
    res.json({ data: campaigns, pagination: { limit, offset, total } });
  } catch (error) { next(error); }
});

// Create campaign (draft)
router.post('/campaigns', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { name, subject, preheader, html_content, text_content } = req.body as {
      name: string; subject: string; preheader?: string; html_content: string; text_content?: string;
    };

    if (!name || !subject || !html_content) {
      return res.status(400).json({ error: { message: 'name, subject, and html_content are required', status: 400 } });
    }

    const campaign = await db.campaigns.create({ name, subject, preheader, html_content, text_content, status: 'draft' });

    await db.adminLogs.create({
      action: 'campaign_create',
      resource: 'campaigns',
      resource_id: campaign.id,
      details: `Created campaign: ${name}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) { next(error); }
});

// Get single campaign
router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    if (!id || isNaN(id)) return res.status(400).json({ error: { message: 'Invalid campaign ID', status: 400 } });

    const campaign = await db.campaigns.findById(id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });

    res.json({ data: campaign });
  } catch (error) { next(error); }
});

// Update draft campaign
router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    if (!id || isNaN(id)) return res.status(400).json({ error: { message: 'Invalid campaign ID', status: 400 } });

    const existing = await db.campaigns.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });
    if (existing.status !== 'draft') return res.status(400).json({ error: { message: 'Only draft campaigns can be edited', status: 400 } });

    const { name, subject, preheader, html_content, text_content } = req.body as {
      name?: string; subject?: string; preheader?: string; html_content?: string; text_content?: string;
    };

    const data: Record<string, string | undefined> = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (preheader !== undefined) data.preheader = preheader;
    if (html_content !== undefined) data.html_content = html_content;
    if (text_content !== undefined) data.text_content = text_content;

    if (!Object.keys(data).length) return res.status(400).json({ error: { message: 'No fields to update', status: 400 } });

    const updated = await db.campaigns.updateById(id, data);

    await db.adminLogs.create({
      action: 'campaign_update',
      resource: 'campaigns',
      resource_id: id,
      details: `Updated campaign: ${Object.keys(data).join(', ')}`,
      ip_address: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Delete draft campaign
router.delete('/campaigns/:id', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    if (!id || isNaN(id)) return res.status(400).json({ error: { message: 'Invalid campaign ID', status: 400 } });

    const deleted = await db.campaigns.deleteById(id);
    if (!deleted) return res.status(404).json({ error: { message: 'Campaign not found or already sent', status: 404 } });

    await db.adminLogs.create({
      action: 'campaign_delete',
      resource: 'campaigns',
      resource_id: id,
      details: 'Deleted draft campaign',
      ip_address: req.ip,
    });

    res.json({ success: true });
  } catch (error) { next(error); }
});

// Send campaign to all active subscribers
router.post('/campaigns/:id/send', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    if (!id || isNaN(id)) return res.status(400).json({ error: { message: 'Invalid campaign ID', status: 400 } });

    const campaign = await db.campaigns.findById(id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });
    if (campaign.status !== 'draft') return res.status(400).json({ error: { message: 'Campaign has already been sent', status: 400 } });

    // Load all active subscribers
    const subscribers = await db.waitlist.findAllActive();
    if (subscribers.length === 0) {
      return res.status(400).json({ error: { message: 'No active subscribers to send to', status: 400 } });
    }

    // Get email provider
    // Resolve active provider (settings override → env config)
    const settingsService = await SettingsService.getInstance();
    const activeProvider = settingsService.get('email_provider') ?? config.email.provider;
    const emailProvider = await EmailFactory.create(activeProvider);

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of subscribers) {
      try {
        await emailProvider.sendCampaign(
          { email: sub.email, name: sub.name },
          {
            subject: campaign.subject,
            preheader: campaign.preheader,
            html: campaign.html_content,
            text: campaign.text_content,
          },
        );
        sentCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${sub.email}: ${msg}`);
        logger.error({ message: `Failed to send campaign to ${sub.email}`, error: err });
      }
    }

    // Mark campaign as sent
    const updated = await db.campaigns.markSent(id, sentCount);

    await db.adminLogs.create({
      action: 'campaign_send',
      resource: 'campaigns',
      resource_id: id,
      details: `Sent campaign "${campaign.name}" to ${sentCount}/${subscribers.length} subscribers${errors.length ? ` (${errors.length} failures)` : ''}`,
      ip_address: req.ip,
    });

    logger.info({ campaignId: id, sentCount, totalSubscribers: subscribers.length, errors: errors.length }, 'Campaign sent');

    res.json({
      success: true,
      data: updated,
      stats: { sent: sentCount, total: subscribers.length, errors: errors.length },
    });
  } catch (error) { next(error); }
});

export default router;