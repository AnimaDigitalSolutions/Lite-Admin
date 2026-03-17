/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateBody } from '../../middleware/validation.js';
import { settingsUpdateSchema, menuUpdateSchema } from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';
import SettingsService from '../../services/settings/index.js';

const router = Router();

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
          rate_limit_forms_max: settingsService.getRateLimitFormsMax(),
          rate_limit_forms_window_minutes: settingsService.getRateLimitFormsWindowMinutes(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update settings
router.put('/settings',
  validateBody(settingsUpdateSchema),
  async (req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const db = await DatabaseService.getInstance();
      const { email_enabled, maintenance_mode, maintenance_message, display_timezone, rate_limit_forms_max, rate_limit_forms_window_minutes } = req.validatedBody;

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
      if (typeof rate_limit_forms_max === 'number') {
        await settingsService.set('rate_limit_forms_max', String(rate_limit_forms_max));
      }
      if (typeof rate_limit_forms_window_minutes === 'number') {
        await settingsService.set('rate_limit_forms_window_minutes', String(rate_limit_forms_window_minutes));
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
          rate_limit_forms_max: settingsService.getRateLimitFormsMax(),
          rate_limit_forms_window_minutes: settingsService.getRateLimitFormsWindowMinutes(),
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
  validateBody(menuUpdateSchema),
  async (req, res, next) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const db = await DatabaseService.getInstance();
      const body = req.validatedBody;

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

export default router;
