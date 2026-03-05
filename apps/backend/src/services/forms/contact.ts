import DatabaseService from '../database.service.js';
import EmailFactory from '../email/index.js';
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
    this.initializeServices();
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

      // Add request metadata
      const submission = {
        ...formData,
        ip_address: requestInfo.ip,
        user_agent: requestInfo.userAgent,
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
        const error = new Error('Contact submission not found') as any;
        error.statusCode = 404;
        throw error;
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
        const error = new Error('Contact submission not found') as any;
        error.statusCode = 404;
        throw error;
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

      // Create test submission data
      const submission = {
        ...formData,
        email: customEmail, // Use custom email for testing
        ip_address: requestInfo.ip,
        user_agent: requestInfo.userAgent,
        is_test: true, // Mark as test
      };

      // Save to database
      const savedContact = await this.db!.contacts.create(submission);
      
      logger.info({
        message: 'Test contact form submission saved',
        data: { id: savedContact.id, email: savedContact.email, is_test: true }
      });

      let emailSent = false;
      // Send test email notification
      try {
        await this.emailService!.sendContactNotification(savedContact);
        emailSent = true;
        logger.info({
          message: 'Test contact notification email sent',
          data: { email: savedContact.email }
        });
      } catch (emailError) {
        logger.error({
          message: 'Failed to send test contact notification email',
          error: emailError
        });
        // Don't throw - we still saved the submission
      }

      // Log admin activity
      await this.db!.adminLogs.create({
        action: 'contact_form_test',
        resource: 'contacts',
        resource_id: savedContact.id,
        details: `Test contact form submission to ${customEmail}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          id: savedContact.id || 0,
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