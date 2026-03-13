import type AhasendProvider from './providers/ahasend.js';
import type ResendProvider from './providers/resend.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import SettingsService from '../settings/index.js';

type EmailProvider = AhasendProvider | ResendProvider;

class EmailFactory {
  private static instance: EmailProvider | null = null;
  private static initPromise: Promise<EmailProvider> | null = null;

  static async create(provider: string): Promise<EmailProvider> {
    if (this.instance) return this.instance;

    if (!this.initPromise) {
      this.initPromise = (async (): Promise<EmailProvider> => {
        logger.info(`Creating email provider: ${provider}`);

        // Merge settings overrides (set via admin UI) on top of env-based config
        let overrides: Record<string, string> = {};
        try {
          const settingsService = await SettingsService.getInstance();
          overrides = settingsService.getAll();
        } catch {
          // Settings not yet ready — fall back to env config
        }

        switch (provider) {
          case 'ahasend': {
            const AhasendProviderModule = await import('./providers/ahasend.js');
            const apiKey = overrides['email_ahasend_api_key'] || config.email.ahasend?.apiKey;
            const accountId = overrides['email_ahasend_account_id'] || config.email.ahasend?.accountId || '';
            if (!apiKey) throw new Error('AhaSend email configuration is missing');
            return new AhasendProviderModule.default({
              apiKey,
              accountId,
              fromAddress: overrides['email_from'] || config.email.from,
              fromName: overrides['email_display_name'] || '',
              notificationEmail: overrides['email_notification_address'] || '',
            });
          }
          case 'resend': {
            const ResendProviderModule = await import('./providers/resend.js');
            const apiKey = overrides['email_resend_api_key'] || config.email.resend?.apiKey;
            if (!apiKey) throw new Error('Resend email configuration is missing');
            return new ResendProviderModule.default({
              apiKey,
              fromAddress: overrides['email_from'] || config.email.from,
              fromName: overrides['email_display_name'] || '',
              notificationEmail: overrides['email_notification_address'] || '',
            });
          }
          default:
            throw new Error(`Unsupported email provider: ${provider}`);
        }
      })().then(instance => {
        this.instance = instance;
        this.initPromise = null;
        return instance;
      });
    }

    return this.initPromise;
  }

  /** Reset the singleton so the next create() picks up new credentials. */
  static reset(): void {
    this.instance = null;
    this.initPromise = null;
    logger.info('Email provider instance reset — will reinitialize on next use');
  }
}

export default EmailFactory;
