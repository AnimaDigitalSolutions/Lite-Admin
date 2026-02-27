import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class EmailFactory {
  static async create(provider) {
    logger.info(`Creating email provider: ${provider}`);
    
    switch (provider) {
      case 'ahasend': {
        const AhasendProvider = await import('./providers/ahasend.js');
        return new AhasendProvider.default(config.email.ahasend);
      }
      case 'resend': {
        const ResendProvider = await import('./providers/resend.js');
        return new ResendProvider.default(config.email.resend);
      }
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }
}

export default EmailFactory;