import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class EmailFactory {
  static async create(provider: string) {
    logger.info(`Creating email provider: ${provider}`);
    
    switch (provider) {
      case 'ahasend': {
        const AhasendProvider = await import('./providers/ahasend.js');
        if (!config.email.ahasend) {
          throw new Error('AhaSend email configuration is missing');
        }
        return new AhasendProvider.default(config.email.ahasend);
      }
      case 'resend': {
        const ResendProvider = await import('./providers/resend.js');
        if (!config.email.resend) {
          throw new Error('Resend email configuration is missing');
        }
        return new ResendProvider.default(config.email.resend);
      }
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }
}

export default EmailFactory;