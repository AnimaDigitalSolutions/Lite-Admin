/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.js';
import { contactListQuerySchema, contactIdSchema, contactTestEmailSchema } from '../../schemas/contact.js';
import {
  contactUpdateSchema, contactStatusUpdateSchema, contactFollowUpSchema,
  contactNoteCreateSchema, contactNoteDueSchema, contactSendEmailSchema,
  contactManualCreateSchema, bulkDeleteSchema, statusHistorySchema,
  activityQuerySchema, idParamSchema, noteIdParamsSchema,
} from '../../schemas/admin.js';
import contactService from '../../services/forms/contact.js';
import DatabaseService from '../../services/database.service.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import SettingsService from '../../services/settings/index.js';
import EmailFactory from '../../services/email/index.js';

const router = Router();

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
router.patch('/submissions/:id',
  validateParams(idParamSchema),
  validateBody(contactUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedParams;
      const data = req.validatedBody;

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
  }
);

// Update contact status
router.patch('/submissions/:id/status',
  validateParams(idParamSchema),
  validateBody(contactStatusUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedParams;
      const { status, comment } = req.validatedBody;

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
  }
);

// Update contact follow-up date
router.patch('/submissions/:id/follow-up',
  validateParams(idParamSchema),
  validateBody(contactFollowUpSchema),
  async (req, res, next) => {
  try {
    const { id } = req.validatedParams;
    const { follow_up_at } = req.validatedBody;

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
router.get('/submissions/activity',
  validateQuery(activityQuerySchema),
  async (req, res, next) => {
  try {
    const { start, end } = req.validatedQuery;

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
router.get('/submissions/:id/notes',
  validateParams(idParamSchema),
  async (req, res, next) => {
  try {
    const { id } = req.validatedParams;

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
router.post('/submissions/:id/notes',
  validateParams(idParamSchema),
  validateBody(contactNoteCreateSchema),
  async (req, res, next) => {
  try {
    const { id } = req.validatedParams;
    const { content, color, subtype, due_at } = req.validatedBody;

    const db = await DatabaseService.getInstance();
    const contact = await db.contacts.findById(id);
    if (!contact) return res.status(404).json({ error: { message: 'Submission not found', status: 404 } });

    const note = await db.contactNotes.create({
      contact_id: id,
      content,
      type: 'manual',
      color,
      subtype,
      due_at: subtype === 'todo' && due_at ? due_at : undefined,
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
router.delete('/submissions/:id/notes/:noteId',
  validateParams(noteIdParamsSchema),
  async (req, res, next) => {
  try {
    const { id, noteId } = req.validatedParams;

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
router.patch('/submissions/:id/notes/:noteId/toggle',
  validateParams(noteIdParamsSchema),
  async (req, res, next) => {
  try {
    const { id, noteId } = req.validatedParams;

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
router.patch('/submissions/:id/notes/:noteId/due',
  validateParams(noteIdParamsSchema),
  validateBody(contactNoteDueSchema),
  async (req, res, next) => {
  try {
    const { id, noteId } = req.validatedParams;
    const { due_at } = req.validatedBody;

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
router.post('/submissions/status-history',
  validateBody(statusHistorySchema),
  async (req, res, next) => {
  try {
    const { ids } = req.validatedBody;
    if (ids.length === 0) {
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
router.post('/submissions/:id/send-email',
  validateParams(idParamSchema),
  validateBody(contactSendEmailSchema),
  async (req, res, _next) => {
  try {
    const { id } = req.validatedParams;
    const { subject, body } = req.validatedBody;

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

// Manually add a contact submission (admin only, no email notification)
router.post('/submissions',
  validateBody(contactManualCreateSchema),
  async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { name, email, company, project_type, message } = req.validatedBody;

    const entry = await db.contacts.create({
      name,
      email,
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

// Bulk delete submissions
router.post('/submissions/bulk-delete',
  validateBody(bulkDeleteSchema),
  async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { ids } = req.validatedBody;
    const deleted = await db.contacts.deleteByIds(ids);
    await db.adminLogs.create({ action: 'contact_bulk_delete', resource: 'contacts', details: `Bulk deleted ${deleted} contact(s)`, ip_address: req.ip });
    res.json({ success: true, deleted });
  } catch (error) { next(error); }
});

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

export default router;
