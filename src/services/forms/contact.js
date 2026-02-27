import DatabaseFactory from '../../database/index.js';
import EmailFactory from '../email/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

class ContactFormService {
  constructor() {
    this.initializeServices();
  }

  async initializeServices() {
    this.db = await DatabaseFactory.create(config.database.type);
    this.emailService = await EmailFactory.create(config.email.provider);
  }

  async processSubmission(formData, requestInfo) {
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
      const savedContact = await this.db.contacts.create(submission);
      
      logger.info('Contact form submission saved', {
        id: savedContact.id,
        email: savedContact.email,
      });

      // Send email notification
      try {
        await this.emailService.sendContactNotification(savedContact);
        logger.info('Contact notification email sent', {
          email: savedContact.email,
        });
      } catch (emailError) {
        logger.error('Failed to send contact notification email', emailError);
        // Don't throw - we still saved the submission
      }

      // Log admin activity
      await this.db.adminLogs.create({
        action: 'contact_form_submission',
        resource: 'contacts',
        resource_id: savedContact.id,
        details: `New contact from ${savedContact.email}`,
        ip_address: requestInfo.ip,
      });

      return {
        success: true,
        data: {
          id: savedContact.id,
          message: 'Your message has been received. We will get back to you soon.',
        },
      };
    } catch (error) {
      logger.error('Contact form processing failed', error);
      throw error;
    }
  }

  async getSubmissions(options = {}) {
    const { limit = 100, offset = 0 } = options;
    
    try {
      const submissions = await this.db.contacts.findAll(limit, offset);
      return submissions;
    } catch (error) {
      logger.error('Failed to fetch contact submissions', error);
      throw error;
    }
  }

  async getSubmissionById(id) {
    try {
      const submission = await this.db.contacts.findById(id);
      if (!submission) {
        const error = new Error('Contact submission not found');
        error.statusCode = 404;
        throw error;
      }
      return submission;
    } catch (error) {
      logger.error('Failed to fetch contact submission', error);
      throw error;
    }
  }

  async deleteSubmission(id, requestInfo) {
    try {
      const deleted = await this.db.contacts.deleteById(id);
      
      if (!deleted) {
        const error = new Error('Contact submission not found');
        error.statusCode = 404;
        throw error;
      }

      // Log admin activity
      await this.db.adminLogs.create({
        action: 'contact_form_deletion',
        resource: 'contacts',
        resource_id: id,
        details: `Deleted contact submission ${id}`,
        ip_address: requestInfo.ip,
      });

      return { success: true, message: 'Submission deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete contact submission', error);
      throw error;
    }
  }
}

export default new ContactFormService();