/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateParams } from '../../middleware/validation.js';
import { idParamSchema } from '../../schemas/admin.js';
import DatabaseService from '../../services/database.service.js';

const router = Router();

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
  validateParams(idParamSchema),
  async (req, res, next) => {
    try {
      const db = await DatabaseService.getInstance();
      const id = req.validatedParams.id;

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

export default router;
