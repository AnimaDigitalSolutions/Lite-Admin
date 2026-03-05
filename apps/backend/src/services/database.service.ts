import DatabaseFactory from '../database/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import type SQLiteAdapter from '../database/adapters/sqlite.js';

class DatabaseService {
  private static instance: SQLiteAdapter | null = null;
  private static initialized = false;

  static async getInstance(): Promise<SQLiteAdapter> {
    if (!this.instance) {
      logger.info('Creating database singleton instance');
      this.instance = await DatabaseFactory.create(config.database.type);
      
      if (!this.initialized) {
        await this.instance.initialize();
        this.initialized = true;
        logger.info(`Database ${config.database.type} singleton initialized`);
      }
    }
    
    return this.instance;
  }

  static async initialize(): Promise<void> {
    await this.getInstance();
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
      this.initialized = false;
      logger.info('Database singleton closed');
    }
  }

  static isInitialized(): boolean {
    return this.initialized && this.instance !== null;
  }
}

export default DatabaseService;