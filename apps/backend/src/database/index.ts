import config from '../config/index.js';
import logger from '../utils/logger.js';

class DatabaseFactory {
  static async create(type: string) {
    logger.info(`Creating database adapter for: ${type}`);
    
    switch (type) {
      case 'sqlite': {
        const SQLiteAdapter = await import('./adapters/sqlite.js');
        return new SQLiteAdapter.default(config.database);
      }
      default: {
        logger.warn(`Database type ${type} not available in this build, using sqlite`);
        const SQLiteAdapter = await import('./adapters/sqlite.js');
        return new SQLiteAdapter.default(config.database);
      }
    }
  }
}

export default DatabaseFactory;