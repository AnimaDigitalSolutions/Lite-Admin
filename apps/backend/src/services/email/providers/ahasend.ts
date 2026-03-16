import axios from 'axios';
import logger from '../../../utils/logger.js';
import config from '../../../config/index.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SettingsService from '../../settings/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AhasendConfig {
  apiKey: string;
  accountId: string;
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

class AhasendProvider {
  private apiKey: string;
  private accountId: string;
  private fromAddress: string;
  private fromName: string;
  private notificationEmail: string;
  private templates: Record<string, string>;

  constructor(providerConfig: AhasendConfig) {
    this.apiKey = providerConfig.apiKey;
    this.accountId = providerConfig.accountId;
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
      if (!this.apiKey) {
        throw new Error('AHASEND_API_KEY is not configured');
      }
      if (!this.accountId) {
        throw new Error('AHASEND_ACCOUNT_ID is not configured');
      }

      const template = await this.loadTemplate(templateName);
      const html = this.renderTemplate(template, data);

      const toName = (data['name'] as string | undefined) ?? '';
      const payload = {
        from: { email: this.fromAddress, name: this.fromName },
        recipients: [{ email: data.to, name: toName }],
        subject: data.subject,
        html_content: html,
        text_content: this.htmlToText(html),
      };

      const response = await axios.post(
        `https://api.ahasend.com/v2/accounts/${this.accountId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status === 200 || status === 202,
        }
      );

      logger.info({
        message: `Email sent via AhaSend: ${templateName}`,
        data: { to: data.to, messageId: response.data?.id }
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ message: `Failed to send email via AhaSend: ${msg}` });
      throw new Error(`Email sending failed: ${msg}`);
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

  async sendDirect(
    to: { email: string; name?: string },
    subject: string,
    content: string,
    options?: { plainText?: boolean; cc?: { email: string; name?: string }[]; bcc?: { email: string; name?: string }[] },
  ): Promise<void> {
    try {
      if (!this.apiKey) throw new Error('AHASEND_API_KEY is not configured');
      if (!this.accountId) throw new Error('AHASEND_ACCOUNT_ID is not configured');

      const payload: Record<string, unknown> = {
        from: { email: this.fromAddress, name: this.fromName },
        recipients: [{ email: to.email, name: to.name || '' }],
        subject,
      };

      if (options?.plainText) {
        payload.text_content = content;
      } else {
        payload.html_content = content;
        payload.text_content = this.htmlToText(content);
      }

      if (options?.cc?.length) {
        payload.cc = options.cc.map(r => ({ email: r.email, name: r.name || '' }));
      }
      if (options?.bcc?.length) {
        payload.bcc = options.bcc.map(r => ({ email: r.email, name: r.name || '' }));
      }

      await axios.post(
        `https://api.ahasend.com/v2/accounts/${this.accountId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status === 200 || status === 202,
        },
      );

      logger.info({ message: `Direct email sent via AhaSend to ${to.email}`, data: { subject } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ message: `Failed to send direct email via AhaSend: ${msg}` });
      throw new Error(`Email sending failed: ${msg}`);
    }
  }

  async sendCampaign(
    subscriber: { email: string; name?: string },
    campaign: { subject: string; preheader?: string; html: string; text?: string },
  ): Promise<void> {
    try {
      if (!this.apiKey) throw new Error('AHASEND_API_KEY is not configured');
      if (!this.accountId) throw new Error('AHASEND_ACCOUNT_ID is not configured');

      const payload = {
        from: { email: this.fromAddress, name: this.fromName },
        recipients: [{ email: subscriber.email, name: subscriber.name || '' }],
        subject: campaign.subject,
        html_content: campaign.html,
        text_content: campaign.text || this.htmlToText(campaign.html),
        ...(campaign.preheader ? { preheader: campaign.preheader } : {}),
      };

      await axios.post(
        `https://api.ahasend.com/v2/accounts/${this.accountId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          validateStatus: (status) => status === 200 || status === 202,
        },
      );

      logger.info({ message: `Campaign email sent via AhaSend to ${subscriber.email}` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ message: `Failed to send campaign email via AhaSend: ${msg}` });
      throw new Error(`Campaign email sending failed: ${msg}`);
    }
  }
}

export default AhasendProvider;
