import axios from 'axios';
import logger from '../../../utils/logger.js';
import config from '../../../config/index.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AhasendConfig {
  apiKey: string;
}

interface EmailData {
  to: string;
  subject: string;
  [key: string]: any;
}

interface ContactData {
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
}

interface WaitlistData {
  email: string;
  name?: string;
}

class AhasendProvider {
  private apiKey: string;
  private apiUrl: string;
  private templates: Record<string, string>;

  constructor(providerConfig: AhasendConfig) {
    this.apiKey = providerConfig.apiKey;
    this.apiUrl = 'https://api.ahasend.com/v1';
    this.templates = {};
  }

  async loadTemplate(templateName: string): Promise<string> {
    if (!this.templates[templateName]) {
      const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
      this.templates[templateName] = await readFile(templatePath, 'utf-8');
    }
    return this.templates[templateName];
  }

  async send(templateName: string, data: EmailData): Promise<void> {
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

      logger.info({
        message: `Email sent via AHASEND: ${templateName}`,
        data: { to: data.to, messageId: response.data.messageId }
      });

    } catch (error) {
      logger.error({
        message: 'Failed to send email via AHASEND',
        error: error
      });
      throw new Error(`Email sending failed: ${(error as any).message}`);
    }
  }

  renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  htmlToText(html: string): string {
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

  async sendContactNotification(contactData: ContactData): Promise<void> {
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

  async sendWaitlistConfirmation(waitlistData: WaitlistData): Promise<void> {
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