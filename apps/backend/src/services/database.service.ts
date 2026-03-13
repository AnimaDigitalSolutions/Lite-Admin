import DatabaseFactory from '../database/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import type SQLiteAdapter from '../database/adapters/sqlite.js';

class DatabaseService {
  private static instance: SQLiteAdapter | null = null;
  private static initialized = false;
  private static initPromise: Promise<SQLiteAdapter> | null = null;

  static async getInstance(): Promise<SQLiteAdapter> {
    if (this.instance) return this.instance;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        logger.info('Creating database singleton instance');
        const instance = await DatabaseFactory.create(config.database.type);
        await instance.initialize();
        this.instance = instance;
        this.initialized = true;
        this.initPromise = null;
        logger.info(`Database ${config.database.type} singleton initialized`);
        return instance;
      })();
    }

    return this.initPromise;
  }

  static async initialize(): Promise<void> {
    await this.getInstance();
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
      this.initialized = false;
      this.initPromise = null;
      logger.info('Database singleton closed');
    }
  }

  static isInitialized(): boolean {
    return this.initialized && this.instance !== null;
  }
}

export default DatabaseService;