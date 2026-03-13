import DatabaseService from '../database.service.js';
import EmailFactory from '../email/index.js';
import GeoService from '../geo/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
// Using local interfaces to avoid circular dependencies
interface Contact {
  id?: number;
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
  ip_address?: string;
  user_agent?: string;
  submitted_at?: string;
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

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
}

interface DatabaseAdapter {
  contacts: {
    create(data: Contact): Promise<Contact>;
    findAll(limit: number, offset: number): Promise<Contact[]>;
    findById(id: string | number): Promise<Contact | null>;
    deleteById(id: string | number): Promise<boolean>;
  };
  adminLogs: {
    create(data: AdminLogData): Promise<void>;
  };
}

interface EmailProvider {
  sendContactNotification(contactData: Contact): Promise<void>;
}

class ContactFormService {
  private db: DatabaseAdapter | null = null;
  private emailService: EmailProvider | null = null;

  constructor() {
    void this.initializeServices();
  }

  async initializeServices(): Promise<void> {
    this.db = await DatabaseService.getInstance();
    this.emailService = await EmailFactory.create(config.email.provider);
  }

  async processSubmission(formData: ContactFormData, requestInfo: RequestInfo): Promise<{ success: boolean; data: { id: number; message: string } }> {
    try {
      // Ensure services are initialized
      if (!this.db || !this.emailService) {
        await this.initializeServices();
      }

      // Geo lookup (non-blocking — empty object on failure)
      const geo = await GeoService.getInstance().lookup(requestInfo.ip);

      // Add request metadata
      const submission = {
        ...formData,
        ip_address: requestInfo.ip,
        user_agent: requestInfo.userAgent,
        site_id: requestInfo.siteId,
        ...geo,
      };

      // Save to database
      const savedContact = await this.db!.contacts.create(submission);
      
      logger.info({
        message: 'Contact form submission saved',
        data: { id: savedContact.id, email: savedContact.email }
      });

      // Send email notification
      try {
        await this.emailService!.sendContactNotification(savedContact);
        logger.info({
          message: 'Contact notification email sent',
          data: { email: savedContact.email }
        });
      } catch (emailError) {
        logger.error({
          message: 'Failed to send contact notification email',
          error: emailError
        });
        // Don't throw - we still saved the submission
      }

      // Log admin activity
      await this.db!.adminLogs.create({
        action: 'contact_form_submission',
        resource: 'contacts',
        resource_id: savedContact.id,
        details: `New contact from ${savedContact.email}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          id: savedContact.id || 0,
          message: 'Your message has been received. We will get back to you soon.',
        },
      };
    } catch (error) {
      logger.error({
        message: 'Contact form processing failed',
        error: error
      });
      throw error;
    }
  }

  async getSubmissions(options: QueryOptions = {}): Promise<Contact[]> {
    const { limit = 100, offset = 0 } = options;
    
    try {
      const submissions = await this.db!.contacts.findAll(limit, offset);
      return submissions;
    } catch (error) {
      logger.error({
        message: 'Failed to fetch contact submissions',
        error: error
      });
      throw error;
    }
  }

  async getSubmissionById(id: string): Promise<Contact> {
    try {
      const submission = await this.db!.contacts.findById(id);
      if (!submission) {
        throw Object.assign(new Error('Contact submission not found'), { statusCode: 404 });
      }
      return submission;
    } catch (error) {
      logger.error({
        message: 'Failed to fetch contact submission',
        error: error
      });
      throw error;
    }
  }

  async deleteSubmission(id: string, requestInfo: RequestInfo): Promise<{ success: boolean; message: string }> {
    try {
      const numericId = parseInt(id, 10);
      const deleted = await this.db!.contacts.deleteById(numericId);
      
      if (!deleted) {
        throw Object.assign(new Error('Contact submission not found'), { statusCode: 404 });
      }

      // Log admin activity
      await this.db!.adminLogs.create({
        action: 'contact_form_deletion',
        resource: 'contacts',
        resource_id: numericId,
        details: `Deleted contact submission ${id}`,
        ip_address: requestInfo.ip,
      });

      return { success: true, message: 'Submission deleted successfully' };
    } catch (error) {
      logger.error({
        message: 'Failed to delete contact submission',
        error: error
      });
      throw error;
    }
  }

  async processTestSubmission(formData: ContactFormData, customEmail: string, requestInfo: RequestInfo): Promise<{ success: boolean; data: { id: number; message: string; email_sent: boolean } }> {
    try {
      // Ensure services are initialized
      if (!this.db || !this.emailService) {
        await this.initializeServices();
      }

      // Build a transient object — no DB write for test emails
      const testContact = {
        id: 0,
        name: formData.name || 'Test User',
        email: customEmail,
        company: formData.company,
        project_type: formData.project_type,
        message: formData.message || '',
        ip_address: requestInfo.ip,
        user_agent: requestInfo.userAgent,
      };

      let emailSent = false;
      try {
        await this.emailService!.sendContactNotification(testContact);
        emailSent = true;
        logger.info({
          message: 'Test contact notification email sent',
          data: { email: customEmail }
        });
      } catch (emailError) {
        const msg = emailError instanceof Error ? emailError.message : String(emailError);
        logger.error({ message: `Failed to send test contact notification email: ${msg}` });
      }

      // Log admin activity (no resource_id — nothing was saved)
      await this.db!.adminLogs.create({
        action: 'contact_form_test',
        resource: 'contacts',
        details: `Test contact email sent to ${customEmail}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          id: 0,
          message: 'Test email sent successfully',
          email_sent: emailSent,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Test contact form processing failed',
        error: error
      });
      throw error;
    }
  }
}

export default new ContactFormService();