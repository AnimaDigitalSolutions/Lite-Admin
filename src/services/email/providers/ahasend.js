import axios from 'axios';
import logger from '../../../utils/logger.js';
import config from '../../../config/index.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AhasendProvider {
  constructor(providerConfig) {
    this.apiKey = providerConfig.apiKey;
    this.apiUrl = 'https://api.ahasend.com/v1';
    this.templates = {};
  }

  async loadTemplate(templateName) {
    if (!this.templates[templateName]) {
      const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
      this.templates[templateName] = await readFile(templatePath, 'utf-8');
    }
    return this.templates[templateName];
  }

  async send(templateName, data) {
    try {
      if (!this.apiKey) {
        throw new Error('AHASEND_API_KEY is not configured');
      }

      const template = await this.loadTemplate(templateName);
      const html = this.renderTemplate(template, data);

      const payload = {
        to: data.to,
        from: data.from || config.email.from,
        subject: data.subject,
        html: html,
        text: this.htmlToText(html),
      };

      const response = await axios.post(
        `${this.apiUrl}/send`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Email sent via AHASEND: ${templateName}`, {
        to: data.to,
        messageId: response.data.messageId,
      });

      return {
        success: true,
        messageId: response.data.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email via AHASEND:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  renderTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async sendContactNotification(contactData) {
    return this.send('contact', {
      to: config.email.from, // Send to admin
      subject: `New Contact Form Submission from ${contactData.name}`,
      name: contactData.name,
      email: contactData.email,
      company: contactData.company || 'Not provided',
      project_type: contactData.project_type || 'Not specified',
      message: contactData.message,
      date: new Date().toISOString(),
    });
  }

  async sendWaitlistConfirmation(waitlistData) {
    return this.send('waitlist', {
      to: waitlistData.email,
      subject: 'Welcome to AnimaDigitalSolutions Waitlist',
      name: waitlistData.name || 'Valued Customer',
      email: waitlistData.email,
      date: new Date().toISOString(),
    });
  }
}

export default AhasendProvider;