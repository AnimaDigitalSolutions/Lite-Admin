import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class StorageFactory {
  static async create(provider: string) {
    logger.info(`Creating storage provider: ${provider}`);
    
    switch (provider) {
      case 'local': {
        const LocalProvider = await import('./providers/local.js');
        if (!config.storage.local) {
          throw new Error('Local storage configuration is missing');
        }
        return new LocalProvider.default(config.storage.local);
      }
      case 's3': {
        const S3Provider = await import('./providers/s3.js');
        if (!config.storage.s3) {
          throw new Error('S3 storage configuration is missing');
        }
        return new S3Provider.default(config.storage.s3);
      }
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}

export default StorageFactory;