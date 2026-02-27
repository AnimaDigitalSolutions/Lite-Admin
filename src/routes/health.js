import { Router } from 'express';
import DatabaseFactory from '../database/index.js';
import config from '../config/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: process.env.npm_package_version || '0.1.0',
    database: {
      type: config.database.type,
      status: 'unknown',
    },
  };

  try {
    // Check database connection
    const db = await DatabaseFactory.create(config.database.type);
    
    // Try a simple query
    if (config.database.type === 'sqlite') {
      await db.get('SELECT 1 as test');
    } else {
      await db.query('SELECT 1 as test');
    }
    
    health.database.status = 'connected';
    res.status(200).json(health);
  } catch (error) {
    health.status = 'unhealthy';
    health.database.status = 'disconnected';
    health.error = error.message;
    res.status(503).json(health);
  }
});

export default router;