import type { Server } from 'http';
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import DatabaseService from './services/database.service.js';
import { authService } from './services/auth/auth.service.js';
import SettingsService from './services/settings/index.js';
import GeoService from './services/geo/index.js';

let server: Server | undefined;

async function startServer() {
  try {
    // Initialize database singleton
    await DatabaseService.initialize();
    
    // Initialize auth service
    await authService.initialize();

    // Initialize settings service (loads runtime toggles from DB)
    await SettingsService.getInstance();

    // Start server
    server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
    });
  } catch (error) {
    logger.error({
      message: 'Failed to start server',
      error: error
    });
    process.exit(1);
  }
}

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        GeoService.getInstance().close(); // stops geolite2-redist background updater
        await DatabaseService.close();
        process.exit(0);
      } catch (error) {
        logger.error({
          message: 'Error during shutdown',
          error: error
        });
        process.exit(1);
      }
    });
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error({
    message: 'Unhandled Rejection at',
    promise: promise,
    reason: reason
  });
});

void startServer();