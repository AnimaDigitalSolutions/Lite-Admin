/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateBody, validateParams } from '../../middleware/validation.js';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  idParamSchema
} from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import SettingsService from '../../services/settings/index.js';
import EmailFactory from '../../services/email/index.js';

const router = Router();

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
router.post('/campaigns', validateBody(campaignCreateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { name, subject, preheader, html_content, text_content, target_type, target_tags } = req.validatedBody;

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
router.get('/campaigns/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;

    const campaign = await db.campaigns.findById(id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });

    res.json({ data: campaign });
  } catch (error) { next(error); }
});

// Update draft campaign
router.patch('/campaigns/:id', validateParams(idParamSchema), validateBody(campaignUpdateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;

    const existing = await db.campaigns.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Campaign not found', status: 404 } });
    if (existing.status !== 'draft') return res.status(400).json({ error: { message: 'Only draft campaigns can be edited', status: 400 } });

    const { name, subject, preheader, html_content, text_content, target_type, target_tags } = req.validatedBody;

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
router.delete('/campaigns/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;

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
router.post('/campaigns/:id/send', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;

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
