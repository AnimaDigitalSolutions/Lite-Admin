import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import DatabaseFactory from './database/index.js';

let server;
let database;

async function startServer() {
  try {
    // Initialize database
    database = await DatabaseFactory.create(config.database.type);
    await database.initialize();
    logger.info(`Database ${config.database.type} initialized`);

    // Start server
    server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        if (database) {
          await database.close();
          logger.info('Database connections closed');
        }
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();