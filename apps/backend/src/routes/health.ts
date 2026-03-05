import { Router } from 'express';
import DatabaseService from '../services/database.service.js';
import config from '../config/index.js';

const router = Router();

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: {
    type: string;
    status: string;
  };
  error?: string;
}

router.get('/', async (req, res) => {
  const health: HealthResponse = {
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
    if (DatabaseService.isInitialized()) {
      const db = await DatabaseService.getInstance();
      
      // Try a simple query
      await db.get('SELECT 1 as test');
      
      health.database.status = 'connected';
    } else {
      health.database.status = 'not_initialized';
    }
    
    res.status(200).json(health);
  } catch (error: unknown) {
    health.status = 'unhealthy';
    health.database.status = 'disconnected';
    health.error = (error as Error)?.message || 'Unknown error';
    res.status(503).json(health);
  }
});

export default router;