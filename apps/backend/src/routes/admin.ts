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
import { invoiceListQuerySchema, invoiceIdSchema, invoiceCreateSchema, invoiceUpdateSchema } from '../schemas/invoice.js';
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

// Update contact status
router.patch('/submissions/:id/status', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { status, comment } = req.body as { status?: string; comment?: string };
    const validStatuses = ['new', 'reviewed', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'archived'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(422).json({ error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, status: 422 } });
    }

    const db = await DatabaseService.getInstance();
    const existing = await db.contacts.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    const oldStatus = (existing as { status?: string }).status || 'new';
    if (oldStatus === status) return res.json({ success: true, data: existing });

    const updated = await db.contacts.updateStatus(id, status as 'new');
    // Auto-create system note for status change
    await db.contactNotes.create({
      contact_id: id,
      content: `Status changed: ${oldStatus} → ${status}`,
      type: 'system',
    });

    // If a comment was provided with the status change, add it as a manual note
    if (comment && comment.trim()) {
      await db.contactNotes.create({
        contact_id: id,
        content: comment.trim(),
        type: 'manual',
        color: 'blue',
        subtype: 'note',
      });
    }

    await db.adminLogs.create({
      action: 'contact_status_update',
      resource: 'contacts',
      resource_id: id,
      details: `Status: ${oldStatus} → ${status}${comment ? ` (with comment)` : ''}`,
      ip_address: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Update contact follow-up date
router.patch('/submissions/:id/follow-up', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { follow_up_at } = req.body as { follow_up_at?: string | null };

    const db = await DatabaseService.getInstance();
    const existing = await db.contacts.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    const updated = await db.contacts.updateFollowUp(id, follow_up_at ?? null);

    // Auto-create system note
    const noteContent = follow_up_at
      ? `Follow-up set: ${new Date(follow_up_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'Follow-up date cleared';
    await db.contactNotes.create({
      contact_id: id,
      content: noteContent,
      type: 'system',
    });

    await db.adminLogs.create({
      action: 'contact_followup_update',
      resource: 'contacts',
      resource_id: id,
      details: follow_up_at ? `Follow-up set to ${follow_up_at}` : 'Follow-up cleared',
      ip_address: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Get contact activity for calendar (all contacts, date range)
router.get('/submissions/activity', async (req, res, next) => {
  try {
    const { start, end } = req.query as { start?: string; end?: string };
    if (!start || !end) return res.status(400).json({ error: { message: 'start and end query params required (YYYY-MM-DD)', status: 400 } });

    const db = await DatabaseService.getInstance();

    // Get notes in range (includes system notes for status changes)
    const notes = await db.contactNotes.findByDateRange(start, end);

    // Get contacts submitted in range
    const submissions = await db.all<{
      id: number; name: string; email: string; company: string; status: string;
      submitted_at: string; follow_up_at: string;
    }>(
      `SELECT id, name, email, company, COALESCE(status, 'new') as status, submitted_at, follow_up_at
       FROM contacts
       WHERE date(submitted_at) >= ? AND date(submitted_at) <= ?
       ORDER BY submitted_at ASC`,
      [start, end]
    );

    // Get contacts with follow-ups in range
    const followUps = await db.all<{
      id: number; name: string; email: string; company: string; status: string;
      follow_up_at: string;
    }>(
      `SELECT id, name, email, company, COALESCE(status, 'new') as status, follow_up_at
       FROM contacts
       WHERE date(follow_up_at) >= ? AND date(follow_up_at) <= ?
       ORDER BY follow_up_at ASC`,
      [start, end]
    );

    return res.json({ success: true, data: { notes, submissions, followUps } });
  } catch (error) {
    next(error);
  }
});

// Get contact notes
router.get('/submissions/:id/notes', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const db = await DatabaseService.getInstance();
    const contact = await db.contacts.findById(id);
    if (!contact) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    const notes = await db.contactNotes.findByContactId(id);
    return res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
});

// Add contact note
router.post('/submissions/:id/notes', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { content, color, subtype, due_at } = req.body as { content?: string; color?: string; subtype?: string; due_at?: string };
    if (!content || !content.trim()) {
      return res.status(422).json({ error: { message: 'Content is required', status: 422 } });
    }

    const validColors = ['gray', 'blue', 'green', 'amber', 'red'];
    const noteColor = color && validColors.includes(color) ? color : undefined;
    const validSubtypes = ['note', 'todo', 'message', 'reply'];
    const noteSubtype = subtype && validSubtypes.includes(subtype) ? subtype as 'note' | 'todo' | 'message' | 'reply' : 'note';

    const db = await DatabaseService.getInstance();
    const contact = await db.contacts.findById(id);
    if (!contact) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    const note = await db.contactNotes.create({
      contact_id: id,
      content: content.trim(),
      type: 'manual',
      color: noteColor,
      subtype: noteSubtype,
      due_at: noteSubtype === 'todo' && due_at ? due_at : undefined,
    });

    await db.adminLogs.create({
      action: 'contact_note_add',
      resource: 'contacts',
      resource_id: id,
      details: `Added note to contact #${id}`,
      ip_address: req.ip,
    });

    return res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
});

// Delete contact note (manual only)
router.delete('/submissions/:id/notes/:noteId', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    const noteId = parseInt(req.params.noteId ?? '', 10);
    if (isNaN(id) || isNaN(noteId)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const db = await DatabaseService.getInstance();
    const note = await db.contactNotes.findById(noteId);
    if (!note) return res.status(404).json({ error: { message: 'Note not found', status: 404 } });
    if (note.type === 'system') return res.status(403).json({ error: { message: 'System notes cannot be deleted', status: 403 } });
    if (note.contact_id !== id) return res.status(404).json({ error: { message: 'Note not found for this contact', status: 404 } });

    await db.contactNotes.deleteById(noteId);

    await db.adminLogs.create({
      action: 'contact_note_delete',
      resource: 'contacts',
      resource_id: id,
      details: `Deleted note #${noteId} from contact #${id}`,
      ip_address: req.ip,
    });

    return res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    next(error);
  }
});

// Toggle todo done/undone
router.patch('/submissions/:id/notes/:noteId/toggle', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    const noteId = parseInt(req.params.noteId ?? '', 10);
    if (isNaN(id) || isNaN(noteId)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const db = await DatabaseService.getInstance();
    const note = await db.contactNotes.findById(noteId);
    if (!note) return res.status(404).json({ error: { message: 'Note not found', status: 404 } });
    if (note.contact_id !== id) return res.status(404).json({ error: { message: 'Note not found for this contact', status: 404 } });
    if ((note as { subtype?: string }).subtype !== 'todo') return res.status(400).json({ error: { message: 'Only todos can be toggled', status: 400 } });

    const updated = await db.contactNotes.toggleDone(noteId);
    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Update todo due date
router.patch('/submissions/:id/notes/:noteId/due', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    const noteId = parseInt(req.params.noteId ?? '', 10);
    if (isNaN(id) || isNaN(noteId)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { due_at } = req.body as { due_at?: string | null };

    const db = await DatabaseService.getInstance();
    const note = await db.contactNotes.findById(noteId);
    if (!note) return res.status(404).json({ error: { message: 'Note not found', status: 404 } });
    if (note.contact_id !== id) return res.status(404).json({ error: { message: 'Note not found for this contact', status: 404 } });
    if ((note as { subtype?: string }).subtype !== 'todo') return res.status(400).json({ error: { message: 'Only todos can have due dates', status: 400 } });

    const updated = await db.contactNotes.updateDueAt(noteId, due_at ?? null);
    return res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Get open todos summary across all contacts
router.get('/submissions/todos-summary', async (_req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const summary = await db.contactNotes.openTodosCount();
    return res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.get('/submissions/todo-contact-ids', async (_req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const ids = await db.contactNotes.openTodoContactIds();
    return res.json({ success: true, data: ids });
  } catch (error) {
    next(error);
  }
});

// Get status change history for a batch of contacts (used by Gantt view)
router.post('/submissions/status-history', async (req, res, next) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true, data: {} });
    }
    // Limit to 100 IDs to prevent abuse
    const limitedIds = ids.slice(0, 100);
    const db = await DatabaseService.getInstance();
    const notes = await db.contactNotes.findStatusChangesByContactIds(limitedIds);

    // Group by contact_id and parse "Status changed: old → new"
    const history: Record<number, { status: string; changed_at: string }[]> = {};
    for (const note of notes) {
      const match = note.content.match(/Status changed: \w+ → (\w+)/);
      if (match) {
        if (!history[note.contact_id]) history[note.contact_id] = [];
        history[note.contact_id].push({
          status: match[1],
          changed_at: note.created_at,
        });
      }
    }

    res.json({ success: true, data: history });
  } catch (error) { next(error); }
});

// Send email directly to a contact
router.post('/submissions/:id/send-email', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id ?? '', 10);
    if (isNaN(id)) return res.status(400).json({ error: { message: 'Invalid id', status: 400 } });

    const { subject, body } = req.body as { subject?: string; body?: string };
    if (!subject || !subject.trim()) {
      return res.status(422).json({ error: { message: 'Subject is required', status: 422 } });
    }
    if (!body || !body.trim()) {
      return res.status(422).json({ error: { message: 'Message body is required', status: 422 } });
    }

    const db = await DatabaseService.getInstance();
    const contact = await db.contacts.findById(id);
    if (!contact) return res.status(404).json({ error: { message: 'Contact not found', status: 404 } });

    const contactEmail = (contact as { email: string }).email;
    const contactName = (contact as { name: string }).name;

    // Determine provider
    let providerName: string = config.email.provider;
    try {
      const settings = await SettingsService.getInstance();
      providerName = settings.get('email_provider') || providerName;
    } catch {
      // use default
    }

    const provider = await EmailFactory.create(providerName);

    await (provider as { sendDirect: (to: { email: string; name?: string }, subject: string, content: string, options?: { plainText?: boolean }) => Promise<void> })
      .sendDirect({ email: contactEmail, name: contactName }, subject.trim(), body, { plainText: true });

    // Log as a 'message' note in the activity thread
    await db.contactNotes.create({
      contact_id: id,
      content: `Email sent — Subject: ${subject.trim()}`,
      type: 'manual',
      color: 'green',
      subtype: 'message',
    });

    await db.adminLogs.create({
      action: 'contact_email_sent',
      resource: 'contacts',
      resource_id: id,
      details: `Email sent to ${contactEmail}: "${subject.trim()}"`,
      ip_address: req.ip,
    });

    return res.json({ success: true, data: { email_sent: true, to: contactEmail } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send email';
    logger.error({ message: `Send email to contact failed: ${msg}`, error });
    return res.status(500).json({ error: { message: msg, status: 500 } });
  }
});

// Compose email to multiple recipients (standalone compose page)
router.post('/email/compose', async (req, res, next) => {
  try {
    const { to, cc, bcc, subject, body } = req.body as {
      to?: { email: string; name?: string }[];
      cc?: { email: string; name?: string }[];
      bcc?: { email: string; name?: string }[];
      subject?: string;
      body?: string;
    };

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(422).json({ error: { message: 'At least one TO recipient is required', status: 422 } });
    }
    if (!subject || !subject.trim()) {
      return res.status(422).json({ error: { message: 'Subject is required', status: 422 } });
    }
    if (!body || !body.trim()) {
      return res.status(422).json({ error: { message: 'Message body is required', status: 422 } });
    }

    // Validate all email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allRecipients = [...to, ...(cc || []), ...(bcc || [])];
    for (const r of allRecipients) {
      if (!emailRegex.test(r.email)) {
        return res.status(422).json({ error: { message: `Invalid email address: ${r.email}`, status: 422 } });
      }
    }

    // Get email provider
    let providerName: string = config.email.provider;
    try {
      const settings = await SettingsService.getInstance();
      providerName = settings.get('email_provider') || providerName;
    } catch {
      // use default
    }

    const provider = await EmailFactory.create(providerName);

    // Send to the first TO recipient with CC/BCC
    const primaryTo = to[0];
    const additionalTo = to.slice(1);
    const mergedCc = [...additionalTo, ...(cc || [])];

    await (provider as { sendDirect: (to: { email: string; name?: string }, subject: string, content: string, options?: { plainText?: boolean; cc?: { email: string; name?: string }[]; bcc?: { email: string; name?: string }[] }) => Promise<void> })
      .sendDirect(primaryTo, subject.trim(), body, {
        plainText: true,
        cc: mergedCc.length ? mergedCc : undefined,
        bcc: bcc?.length ? bcc : undefined,
      });

    // Auto-log notes on matching contacts
    const db = await DatabaseService.getInstance();
    const allToEmails = to.map(r => r.email.toLowerCase());
    const contacts = await db.contacts.findAll();
    const contactsByEmail = new Map<string, { id: number }>();
    for (const c of contacts) {
      contactsByEmail.set((c as { email: string }).email.toLowerCase(), c as { id: number });
    }

    for (const email of allToEmails) {
      const match = contactsByEmail.get(email);
      if (match) {
        await db.contactNotes.create({
          contact_id: match.id,
          content: `Email sent — Subject: ${subject.trim()}`,
          type: 'manual',
          color: 'green',
          subtype: 'message',
        });
      }
    }

    // Also check CC recipients for contact matches
    for (const r of (cc || [])) {
      const match = contactsByEmail.get(r.email.toLowerCase());
      if (match) {
        await db.contactNotes.create({
          contact_id: match.id,
          content: `CC'd on email — Subject: ${subject.trim()}`,
          type: 'manual',
          color: 'green',
          subtype: 'message',
        });
      }
    }

    const recipientSummary = allToEmails.join(', ');
    await db.adminLogs.create({
      action: 'compose_email_sent',
      resource: 'email',
      details: `Compose email sent to ${recipientSummary}: "${subject.trim()}"`,
      ip_address: req.ip,
    });

    return res.json({ success: true, data: { email_sent: true, to: allToEmails } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send email';
    logger.error({ message: `Compose email failed: ${msg}`, error });
    return res.status(500).json({ error: { message: msg, status: 500 } });
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

// Get all unique tags from subscribers
router.get('/waitlist/tags', async (_req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const tags = await db.waitlist.getAllTags();
    res.json({ data: tags });
  } catch (error) { next(error); }
});

// Count subscribers matching a target (used by campaign form)
router.get('/waitlist/count-by-target', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const targetType = (req.query['target_type'] as string) || 'all';
    const tagsParam = req.query['tags'] as string;
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];
    const count = await db.waitlist.countByTarget(
      targetType === 'tagged' ? 'tagged' : 'all',
      tags,
    );
    res.json({ data: { count } });
  } catch (error) { next(error); }
});

// Preview recipients matching a target (returns subscriber list for preview)
router.get('/waitlist/preview-recipients', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const targetType = (req.query['target_type'] as string) || 'all';
    const tagsParam = req.query['tags'] as string;
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];
    let subscribers;
    if (targetType === 'tagged' && tags.length > 0) {
      subscribers = await db.waitlist.findActiveByTags(tags);
    } else {
      subscribers = await db.waitlist.findAllActive();
    }
    // Return only the fields needed for preview
    const preview = subscribers.map(s => ({
      id: s.id,
      email: s.email,
      name: s.name,
      tags: s.tags,
    }));
    res.json({ data: preview, total: preview.length });
  } catch (error) { next(error); }
});

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
    const { name, subject, preheader, html_content, text_content, target_type, target_tags } = req.body as {
      name: string; subject: string; preheader?: string; html_content: string; text_content?: string;
      target_type?: 'all' | 'tagged'; target_tags?: string[];
    };

    if (!name || !subject || !html_content) {
      return res.status(400).json({ error: { message: 'name, subject, and html_content are required', status: 400 } });
    }

    const campaign = await db.campaigns.create({
      name, subject, preheader, html_content, text_content, status: 'draft',
      target_type: target_type || 'all',
      target_tags: target_tags && target_tags.length ? JSON.stringify(target_tags) : undefined,
    });

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

    const { name, subject, preheader, html_content, text_content, target_type, target_tags } = req.body as {
      name?: string; subject?: string; preheader?: string; html_content?: string; text_content?: string;
      target_type?: 'all' | 'tagged'; target_tags?: string[];
    };

    const data: Record<string, string | undefined> = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (preheader !== undefined) data.preheader = preheader;
    if (html_content !== undefined) data.html_content = html_content;
    if (text_content !== undefined) data.text_content = text_content;
    if (target_type !== undefined) data.target_type = target_type;
    if (target_tags !== undefined) data.target_tags = JSON.stringify(target_tags);

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

// Send campaign to targeted subscribers
router.post('/campaigns/:id/send', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = Number(req.params['id']);
    if (!id || isNaN(id)) return res.status(400).json({ error: { message: 'Invalid campaign ID', status: 400 } });

    const campaign = await db.campaigns.findById(id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });
    if (campaign.status !== 'draft') return res.status(400).json({ error: { message: 'Campaign has already been sent', status: 400 } });

    // Load subscribers based on campaign targeting
    let subscribers;
    if (campaign.target_type === 'tagged' && campaign.target_tags) {
      const tags = JSON.parse(campaign.target_tags) as string[];
      subscribers = tags.length ? await db.waitlist.findActiveByTags(tags) : await db.waitlist.findAllActive();
    } else {
      subscribers = await db.waitlist.findAllActive();
    }
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

// ─── INVOICES ────────────────────────────────────────────────────────────────

// List invoices
router.get('/invoices', validateQuery(invoiceListQuerySchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { limit, offset, status } = req.validatedQuery;
    const [invoices, total] = await Promise.all([
      db.invoices.findAll(limit, offset, status),
      db.invoices.count(status),
    ]);
    res.json({ success: true, data: invoices, pagination: { limit, offset, total } });
  } catch (error) { next(error); }
});

// Get single invoice with items
router.get('/invoices/:id', validateParams(invoiceIdSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const invoice = await db.invoices.findById(id);
    if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    const items = await db.invoiceItems.findByInvoiceId(id);
    res.json({ success: true, data: { ...invoice, items } });
  } catch (error) { next(error); }
});

// Create invoice
router.post('/invoices', validateBody(invoiceCreateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const data = req.validatedBody;
    const items = data.items || [];

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price: number }) => sum + item.quantity * item.unit_price, 0);
    const taxAmount = subtotal * (data.tax_rate || 0) / 100;
    const total = subtotal + taxAmount - (data.discount || 0);

    // Auto-generate invoice number if not provided
    const invoiceNumber = data.invoice_number || await db.invoices.nextNumber();

    const invoice = await db.invoices.create({
      ...data,
      invoice_number: invoiceNumber,
      subtotal,
      tax_amount: taxAmount,
      total,
    });

    if (items.length > 0 && invoice.id) {
      await db.invoiceItems.createMany(
        invoice.id,
        items.map((item: { description: string; quantity: number; unit_price: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
        }))
      );
    }

    const createdItems = invoice.id ? await db.invoiceItems.findByInvoiceId(invoice.id) : [];

    await db.adminLogs.create({
      action: 'create',
      resource: 'invoice',
      resource_id: invoice.id,
      details: `Created invoice ${invoiceNumber}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: { ...invoice, items: createdItems } });
  } catch (error) { next(error); }
});

// Update invoice
router.patch('/invoices/:id', validateParams(invoiceIdSchema), validateBody(invoiceUpdateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const data = req.validatedBody;

    const existing = await db.invoices.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });

    // If items are provided, recalculate totals
    const items = data.items;
    if (items) {
      const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price: number }) => sum + item.quantity * item.unit_price, 0);
      const taxRate = data.tax_rate ?? existing.tax_rate;
      const discount = data.discount ?? existing.discount;
      const taxAmount = subtotal * taxRate / 100;
      data.subtotal = subtotal;
      data.tax_amount = taxAmount;
      data.total = subtotal + taxAmount - discount;

      // Replace items
      await db.invoiceItems.deleteByInvoiceId(id);
      await db.invoiceItems.createMany(
        id,
        items.map((item: { description: string; quantity: number; unit_price: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
        }))
      );
    }

    // Remove items from update data (it's not a column)
    delete data.items;

    const updated = await db.invoices.updateById(id, data);
    const updatedItems = await db.invoiceItems.findByInvoiceId(id);

    await db.adminLogs.create({
      action: 'update',
      resource: 'invoice',
      resource_id: id,
      details: `Updated invoice ${existing.invoice_number}`,
      ip_address: req.ip,
    });

    res.json({ success: true, data: { ...updated, items: updatedItems } });
  } catch (error) { next(error); }
});

// Delete invoice
router.delete('/invoices/:id', validateParams(invoiceIdSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const invoice = await db.invoices.findById(id);
    if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });

    await db.invoices.deleteById(id);

    await db.adminLogs.create({
      action: 'delete',
      resource: 'invoice',
      resource_id: id,
      details: `Deleted invoice ${invoice.invoice_number}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) { next(error); }
});

// Get next invoice number
router.get('/invoices-next-number', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const nextNumber = await db.invoices.nextNumber();
    res.json({ success: true, data: { invoice_number: nextNumber } });
  } catch (error) { next(error); }
});

export default router;