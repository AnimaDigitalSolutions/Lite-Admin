import DatabaseService from '../database.service.js';
import logger from '../../utils/logger.js';

const DEFAULTS: Record<string, string> = {
  email_enabled: 'true',
  maintenance_mode: 'false',
  maintenance_message: 'We are currently under maintenance. Please check back soon.',
  rate_limit_forms_max: '10',
  rate_limit_forms_window_minutes: '10',
};

class SettingsService {
  private static instance: SettingsService | null = null;
  private static initPromise: Promise<SettingsService> | null = null;
  private cache: Record<string, string> = {};

  private constructor() {}

  static async getInstance(): Promise<SettingsService> {
    if (this.instance) return this.instance;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const service = new SettingsService();
        await service.initialize();
        SettingsService.instance = service;
        SettingsService.initPromise = null;
        return service;
      })();
    }
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const db = await DatabaseService.getInstance();
    const stored = await db.settings.getAll();
    this.cache = { ...DEFAULTS, ...stored };

    // Persist any missing defaults
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (!(key in stored)) {
        await db.settings.set(key, value);
      }
    }

    logger.info('Settings service initialized');
  }

  get(key: string): string | undefined {
    return this.cache[key];
  }

  async set(key: string, value: string): Promise<void> {
    const db = await DatabaseService.getInstance();
    await db.settings.set(key, value);
    this.cache[key] = value;
  }

  getAll(): Record<string, string> {
    return { ...this.cache };
  }

  isEmailEnabled(): boolean {
    return this.cache['email_enabled'] !== 'false';
  }

  isMaintenanceMode(): boolean {
    return this.cache['maintenance_mode'] === 'true';
  }

  getMaintenanceMessage(): string {
    return this.cache['maintenance_message'] ?? DEFAULTS['maintenance_message'] ?? 'Maintenance in progress.';
  }

  getRateLimitFormsMax(): number {
    return parseInt(this.cache['rate_limit_forms_max'] ?? '10', 10) || 10;
  }

  getRateLimitFormsWindowMinutes(): number {
    return parseInt(this.cache['rate_limit_forms_window_minutes'] ?? '10', 10) || 10;
  }
}

export default SettingsService;
