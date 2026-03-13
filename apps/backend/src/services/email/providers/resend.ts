import { Resend } from 'resend';
import logger from '../../../utils/logger.js';
import config from '../../../config/index.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SettingsService from '../../settings/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ResendConfig {
  apiKey: string;
  fromAddress?: string;
  fromName?: string;
  notificationEmail?: string;
}

interface EmailData {
  to: string;
  subject: string;
  [key: string]: unknown;
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

class ResendProvider {
  private apiKey: string;
  private resend: Resend | null;
  private fromAddress: string;
  private fromName: string;
  private notificationEmail: string;
  private templates: Record<string, string>;

  constructor(providerConfig: ResendConfig) {
    this.apiKey = providerConfig.apiKey;
    this.resend = this.apiKey ? new Resend(this.apiKey) : null;
    this.fromAddress = providerConfig.fromAddress || config.email.from;
    this.fromName = providerConfig.fromName || 'Lite Admin';
    this.notificationEmail = providerConfig.notificationEmail || providerConfig.fromAddress || config.email.from;
    this.templates = {};
  }

  async loadTemplate(templateName: string): Promise<string> {
    // Check for DB override (custom template set via admin UI)
    try {
      const settings = await SettingsService.getInstance();
      const custom = settings.get(`email_template_${templateName}`);
      if (custom) return custom;
    } catch {
      // Settings not ready — fall through to file
    }

    if (!this.templates[templateName]) {
      const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
      this.templates[templateName] = await readFile(templatePath, 'utf-8');
    }
    return this.templates[templateName];
  }

  async send(templateName: string, data: EmailData): Promise<void> {
    try {
      if (!this.resend) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const template = await this.loadTemplate(templateName);
      const html = this.renderTemplate(template, data);

      const payload = {
        to: [data.to],
        from: (data['from'] as string | undefined) ?? (this.fromName ? `${this.fromName} <${this.fromAddress}>` : this.fromAddress),
        subject: data.subject,
        html: html,
        text: this.htmlToText(html),
      };

      const response = await this.resend.emails.send(payload);

      logger.info({
        message: `Email sent via Resend: ${templateName}`,
        data: { to: data.to, id: response.data?.id }
      });

    } catch (error) {
      logger.error({
        message: 'Failed to send email via Resend',
        error: error
      });
      throw new Error(`Email sending failed: ${(error as Error).message}`);
    }
  }

  renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(data[key] ?? match);
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
      to: this.notificationEmail,
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

  async sendCampaign(
    subscriber: { email: string; name?: string },
    campaign: { subject: string; preheader?: string; html: string; text?: string },
  ): Promise<void> {
    try {
      if (!this.resend) throw new Error('RESEND_API_KEY is not configured');

      const payload = {
        to: [subscriber.email],
        from: this.fromName ? `${this.fromName} <${this.fromAddress}>` : this.fromAddress,
        subject: campaign.subject,
        html: campaign.html,
        text: campaign.text || this.htmlToText(campaign.html),
      };

      await this.resend.emails.send(payload);

      logger.info({ message: `Campaign email sent via Resend to ${subscriber.email}` });
    } catch (error) {
      logger.error({ message: 'Failed to send campaign email via Resend', error });
      throw new Error(`Campaign email sending failed: ${(error as Error).message}`);
    }
  }
}

export default ResendProvider;