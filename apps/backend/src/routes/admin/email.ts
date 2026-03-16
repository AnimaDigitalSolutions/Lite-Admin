/// <reference path="../../types/express.d.ts" />
import path from 'path';
import { Router } from 'express';
import { validateBody } from '../../middleware/validation.js';
import {
  composeEmailSchema,
  emailTemplateUpdateSchema,
  credentialsUpdateSchema,
  verifyKeySchema
} from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import SettingsService from '../../services/settings/index.js';
import EmailFactory from '../../services/email/index.js';

const router = Router();

// Compose email to multiple recipients (standalone compose page)
router.post('/email/compose', validateBody(composeEmailSchema), async (req, res, _next) => {
  try {
    const { to, cc, bcc, subject, body } = req.validatedBody;

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
    const allToEmails = to.map((r: { email: string }) => r.email.toLowerCase());
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

// === EMAIL TEMPLATES ===

// List all templates (DB override + file default)
router.get('/email-templates', async (_req, res, next) => {
  try {
    const settingsService = await SettingsService.getInstance();

    // Read default templates from filesystem
    const templatesDir = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../services/email/templates'
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
router.put('/email-templates/:name', validateBody(emailTemplateUpdateSchema), async (req, res, next) => {
  try {
    const { name } = req.params;
    const validNames = ['contact', 'waitlist'];
    if (!name || typeof name !== 'string' || !validNames.includes(name)) {
      return res.status(400).json({ error: { message: `Invalid template name. Must be one of: ${validNames.join(', ')}`, status: 400 } });
    }

    const { html } = req.validatedBody;

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
    if (!name || typeof name !== 'string' || !validNames.includes(name)) {
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

router.put('/credentials', validateBody(credentialsUpdateSchema), async (req, res, next) => {
  try {
    const settingsService = await SettingsService.getInstance();
    const db = await DatabaseService.getInstance();
    const { email, storage } = req.validatedBody;

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

// Verify API key
router.post('/credentials/verify-key', validateBody(verifyKeySchema), async (req, res, next) => {
  try {
    const { provider, api_key } = req.validatedBody;

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

export default router;
