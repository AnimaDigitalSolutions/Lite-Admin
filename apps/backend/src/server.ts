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

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`\n❌ Port ${config.port} is already in use.\n`);
        logger.error(`Fix it by either:`);
        logger.error(`  1. Kill the process:  kill -9 $(lsof -t -i:${config.port})`);
        logger.error(`  2. Change PORT in .env to a different value\n`);
      } else {
        logger.error({ message: 'Failed to start server', error: err });
      }
      process.exit(1);
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
process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
  logger.error({
    message: 'Unhandled Rejection',
    err: reason instanceof Error ? reason : new Error(String(reason)),
  });
});

void startServer();