/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.js';
import { bulkDeleteSchema, idParamSchema, waitlistManualCreateSchema, waitlistUpdateSchema } from '../../schemas/admin.js';
import { waitlistListQuerySchema, waitlistTestEmailSchema } from '../../schemas/waitlist.js';
import waitlistService from '../../services/forms/waitlist.js';
import DatabaseService from '../../services/database.service.js';
import logger from '../../utils/logger.js';

const router = Router();

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
router.patch('/waitlist/:id',
  validateParams(idParamSchema),
  validateBody(waitlistUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedParams;
      const data = req.validatedBody;

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

// Manually add a waitlist entry (admin only, no confirmation email)
router.post('/waitlist',
  validateBody(waitlistManualCreateSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { email, name } = req.validatedBody;

      const entry = await db.waitlist.create({
        email,
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
  }
);

// Bulk delete waitlist entries
router.post('/waitlist/bulk-delete',
  validateBody(bulkDeleteSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const { ids } = req.validatedBody;
      const deleted = await db.waitlist.deleteByIds(ids);
      await db.adminLogs.create({ action: 'waitlist_bulk_delete', resource: 'waitlist', details: `Bulk deleted ${deleted} waitlist entry(s)`, ip_address: req.ip });
      res.json({ success: true, deleted });
    } catch (error) { next(error); }
  }
);

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
