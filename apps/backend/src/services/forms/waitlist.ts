import DatabaseService from '../database.service.js';
import EmailFactory from '../email/index.js';
import GeoService from '../geo/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
// Using local interfaces to avoid circular dependencies
interface WaitlistEntry {
  id?: number;
  email: string;
  name?: string;
  ip_address?: string;
  signed_up_at?: string;
  is_test?: boolean;
}

interface AdminLogData {
  action: string;
  resource: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
}


interface RequestInfo {
  ip: string;
  userAgent?: string;
  siteId?: number;
}

interface WaitlistFormData {
  email: string;
  name?: string;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
}

interface DatabaseAdapter {
  waitlist: {
    create(data: WaitlistEntry): Promise<WaitlistEntry>;
    findAll(limit: number, offset: number): Promise<WaitlistEntry[]>;
    findByEmail(email: string): Promise<WaitlistEntry | null>;
  };
  adminLogs: {
    create(data: AdminLogData): Promise<void>;
  };
}

interface EmailProvider {
  sendWaitlistConfirmation(waitlistData: WaitlistEntry): Promise<void>;
}

class WaitlistService {
  private db: DatabaseAdapter | null = null;
  private emailService: EmailProvider | null = null;

  constructor() {
    void this.initializeServices();
  }

  async initializeServices(): Promise<void> {
    this.db = await DatabaseService.getInstance();
    this.emailService = await EmailFactory.create(config.email.provider);
  }

  async addToWaitlist(data: WaitlistFormData, requestInfo: RequestInfo): Promise<{ success: boolean; data: { id?: string; message: string; alreadyExists?: boolean } }> {
    try {
      // Ensure services are initialized
      if (!this.db || !this.emailService) {
        await this.initializeServices();
      }

      // Check if email already exists
      const existing = await this.db!.waitlist.findByEmail(data.email);
      if (existing) {
        return {
          success: true,
          data: {
            id: existing.id?.toString() || 'unknown',
            message: 'You are already on our waitlist!',
            alreadyExists: true,
          },
        };
      }

      // Geo lookup (non-blocking — empty object on failure)
      const geo = await GeoService.getInstance().lookup(requestInfo.ip);

      // Add request metadata
      const waitlistEntry = {
        ...data,
        ip_address: requestInfo.ip,
        site_id: requestInfo.siteId,
        ...geo,
      };

      // Save to database
      const savedEntry = await this.db!.waitlist.create(waitlistEntry);
      
      logger.info({
        message: 'Waitlist signup successful',
        data: {
          id: savedEntry.id,
          email: savedEntry.email
        }
      });

      // Send confirmation email
      try {
        await this.emailService!.sendWaitlistConfirmation(savedEntry);
        logger.info({
          message: 'Waitlist confirmation email sent',
          data: {
            email: savedEntry.email
          }
        });
      } catch (emailError) {
        logger.error({
          message: 'Failed to send waitlist confirmation email',
          error: emailError
        });
        // Don't throw - we still saved the signup
      }

      // Log admin activity
      await this.db!.adminLogs.create({
        action: 'waitlist_signup',
        resource: 'waitlist',
        resource_id: savedEntry.id,
        details: `New waitlist signup: ${savedEntry.email}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          id: savedEntry.id?.toString() || 'unknown',
          message: 'Successfully added to waitlist! Check your email for confirmation.',
        },
      };
    } catch (error) {
      logger.error({
        message: 'Waitlist signup failed',
        error: error
      });
      throw error;
    }
  }

  async getWaitlistEntries(options: QueryOptions = {}) {
    const { limit = 100, offset = 0 } = options;
    
    try {
      const entries = await this.db!.waitlist.findAll(limit, offset);
      return entries;
    } catch (error) {
      logger.error({
        message: 'Failed to fetch waitlist entries',
        error: error
      });
      throw error;
    }
  }

  async checkEmailStatus(email: string) {
    try {
      const entry = await this.db!.waitlist.findByEmail(email);
      return {
        exists: !!entry,
        entry: entry || null,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to check email status',
        error: error
      });
      throw error;
    }
  }

  async exportWaitlist() {
    try {
      // Get all entries
      const entries = await this.db!.waitlist.findAll(10000, 0); // Large limit for export
      
      // Format for CSV
      const csvHeaders = ['ID', 'Email', 'Name', 'Signed Up At', 'IP Address'];
      const csvRows = entries.map(entry => [
        entry.id,
        entry.email,
        entry.name || '',
        entry.signed_up_at,
        entry.ip_address || '',
      ]);
      
      return {
        headers: csvHeaders,
        rows: csvRows,
        count: entries.length,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to export waitlist',
        error: error
      });
      throw error;
    }
  }

  async addTestToWaitlist(customEmail: string, formData: WaitlistFormData, requestInfo: RequestInfo): Promise<{ success: boolean; data: { id?: string; message: string; email_sent: boolean } }> {
    try {
      // Ensure services are initialized
      if (!this.db || !this.emailService) {
        await this.initializeServices();
      }

      // Build a transient object — no DB write for test emails
      const testEntry = {
        id: 0,
        email: customEmail,
        name: formData.name,
      };

      let emailSent = false;
      try {
        await this.emailService!.sendWaitlistConfirmation(testEntry);
        emailSent = true;
        logger.info({
          message: 'Test waitlist confirmation email sent',
          data: { email: customEmail }
        });
      } catch (emailError) {
        const msg = emailError instanceof Error ? emailError.message : String(emailError);
        logger.error({ message: `Failed to send test waitlist confirmation email: ${msg}` });
      }

      // Log admin activity (no resource_id — nothing was saved)
      await this.db!.adminLogs.create({
        action: 'waitlist_test',
        resource: 'waitlist',
        details: `Test waitlist email sent to ${customEmail}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          message: 'Test waitlist email sent successfully',
          email_sent: emailSent,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Test waitlist signup failed',
        error: error
      });
      throw error;
    }
  }
}

export default new WaitlistService();