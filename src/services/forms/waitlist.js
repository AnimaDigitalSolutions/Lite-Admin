import DatabaseFactory from '../../database/index.js';
import EmailFactory from '../email/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class WaitlistService {
  constructor() {
    this.initializeServices();
  }

  async initializeServices() {
    this.db = await DatabaseFactory.create(config.database.type);
    this.emailService = await EmailFactory.create(config.email.provider);
  }

  async addToWaitlist(data, requestInfo) {
    try {
      // Ensure services are initialized
      if (!this.db || !this.emailService) {
        await this.initializeServices();
      }

      // Check if email already exists
      const existing = await this.db.waitlist.findByEmail(data.email);
      if (existing) {
        return {
          success: true,
          data: {
            message: 'You are already on our waitlist!',
            alreadyExists: true,
          },
        };
      }

      // Add request metadata
      const waitlistEntry = {
        ...data,
        ip_address: requestInfo.ip,
      };

      // Save to database
      const savedEntry = await this.db.waitlist.create(waitlistEntry);
      
      logger.info('Waitlist signup successful', {
        id: savedEntry.id,
        email: savedEntry.email,
      });

      // Send confirmation email
      try {
        await this.emailService.sendWaitlistConfirmation(savedEntry);
        logger.info('Waitlist confirmation email sent', {
          email: savedEntry.email,
        });
      } catch (emailError) {
        logger.error('Failed to send waitlist confirmation email', emailError);
        // Don't throw - we still saved the signup
      }

      // Log admin activity
      await this.db.adminLogs.create({
        action: 'waitlist_signup',
        resource: 'waitlist',
        resource_id: savedEntry.id,
        details: `New waitlist signup: ${savedEntry.email}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          message: 'Successfully added to waitlist! Check your email for confirmation.',
        },
      };
    } catch (error) {
      logger.error('Waitlist signup failed', error);
      throw error;
    }
  }

  async getWaitlistEntries(options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    try {
      const entries = await this.db.waitlist.findAll(limit, offset);
      return entries;
    } catch (error) {
      logger.error('Failed to fetch waitlist entries', error);
      throw error;
    }
  }

  async checkEmailStatus(email) {
    try {
      const entry = await this.db.waitlist.findByEmail(email);
      return {
        exists: !!entry,
        entry: entry || null,
      };
    } catch (error) {
      logger.error('Failed to check email status', error);
      throw error;
    }
  }

  async exportWaitlist() {
    try {
      // Get all entries
      const entries = await this.db.waitlist.findAll(10000, 0); // Large limit for export
      
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
      logger.error('Failed to export waitlist', error);
      throw error;
    }
  }
}

export default new WaitlistService();