/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { validateBody, validateParams } from '../../middleware/validation.js';
import { siteCreateSchema, siteToggleSchema, sitePermissionsSchema, idParamSchema } from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';

const router = Router();

const generateSiteKey = () => `lsk_${randomBytes(24).toString('hex')}`;

router.get('/sites', async (_req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const sites = await db.sites.findAll();
    res.json({ data: sites });
  } catch (error) { next(error); }
});

router.post('/sites', validateBody(siteCreateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();

    const { name, domain, description, permissions } = req.validatedBody;

    const site = await db.sites.create({ name, domain, description, api_key: generateSiteKey(), is_active: true, permissions: permissions?.join(',') });
    await db.adminLogs.create({ action: 'site_create', resource: 'sites', resource_id: site.id, details: `Created site: ${name}`, ip_address: req.ip });
    res.status(201).json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.post('/sites/:id/regenerate', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;
    const newKey = generateSiteKey();
    const updated = await db.sites.updateApiKey(id, newKey);
    if (!updated) return res.status(404).json({ error: { message: 'Site not found', status: 404 } });

    await db.adminLogs.create({ action: 'site_key_regenerate', resource: 'sites', resource_id: id, details: 'API key regenerated', ip_address: req.ip });
    const site = await db.sites.findById(id);
    res.json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.patch('/sites/:id', validateParams(idParamSchema), validateBody(siteToggleSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;
    const { is_active } = req.validatedBody;
    if (typeof is_active === 'boolean') await db.sites.toggleActive(id, is_active);
    const site = await db.sites.findById(id);
    res.json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.put('/sites/:id/permissions', validateParams(idParamSchema), validateBody(sitePermissionsSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;
    const { permissions } = req.validatedBody;
    const updated = await db.sites.updatePermissions(id, permissions.join(','));
    if (!updated) return res.status(404).json({ error: { message: 'Site not found', status: 404 } });

    await db.adminLogs.create({ action: 'site_permissions_update', resource: 'sites', resource_id: id, details: `Permissions set to: ${permissions.join(', ')}`, ip_address: req.ip });
    const site = await db.sites.findById(id);
    res.json({ success: true, data: site });
  } catch (error) { next(error); }
});

router.delete('/sites/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const id = req.validatedParams.id;
    const deleted = await db.sites.deleteById(id);
    if (!deleted) return res.status(404).json({ error: { message: 'Site not found', status: 404 } });
    await db.adminLogs.create({ action: 'site_delete', resource: 'sites', resource_id: id, details: 'Site deleted', ip_address: req.ip });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
