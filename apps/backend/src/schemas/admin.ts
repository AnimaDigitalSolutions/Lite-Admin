import { z } from 'zod';

// === CONTACTS ===

export const contactUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email('Invalid email address').max(255).trim().toLowerCase().optional(),
  company: z.string().max(100).trim().optional(),
  project_type: z.string().max(50).trim().optional(),
  message: z.string().max(5000).trim().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

const contactStatuses = ['new', 'reviewed', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'archived'] as const;

export const contactStatusUpdateSchema = z.object({
  status: z.enum(contactStatuses),
  comment: z.string().max(2000).trim().optional(),
});

export const contactFollowUpSchema = z.object({
  follow_up_at: z.string().nullable().optional(),
});

export const contactNoteCreateSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000).trim(),
  color: z.enum(['gray', 'blue', 'green', 'amber', 'red']).optional(),
  subtype: z.enum(['note', 'todo', 'message', 'reply']).default('note'),
  due_at: z.string().optional(),
});

export const contactNoteDueSchema = z.object({
  due_at: z.string().nullable().optional(),
});

export const contactSendEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500).trim(),
  body: z.string().min(1, 'Message body is required').max(50000).trim(),
});

export const contactManualCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  company: z.string().max(100).trim().optional(),
  project_type: z.string().max(50).trim().optional(),
  message: z.string().min(1, 'message is required').max(5000).trim(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids must be a non-empty array'),
});

export const statusHistorySchema = z.object({
  ids: z.array(z.number().int().positive()).optional().default([]),
});

export const activityQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD'),
});

// === WAITLIST ===

export const waitlistUpdateSchema = z.object({
  name: z.string().max(100).trim().optional(),
  email: z.string().email('Invalid email address').max(255).trim().toLowerCase().optional(),
  tags: z.string().max(500).trim().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

export const waitlistManualCreateSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
  name: z.string().max(100).trim().optional(),
});

// === MEDIA ===

export const mediaRenameSchema = z.object({
  name: z.string().min(1, 'name is required').max(255).trim(),
});

export const mediaBulkDownloadSchema = z.object({
  ids: z.array(z.union([z.string(), z.number()])).min(1, 'ids array is required'),
});

// === CAMPAIGNS ===

export const campaignCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200).trim(),
  subject: z.string().min(1, 'subject is required').max(500).trim(),
  preheader: z.string().max(500).trim().optional(),
  html_content: z.string().min(1, 'html_content is required'),
  text_content: z.string().optional(),
  target_type: z.enum(['all', 'tagged']).default('all'),
  target_tags: z.array(z.string()).optional(),
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  subject: z.string().min(1).max(500).trim().optional(),
  preheader: z.string().max(500).trim().optional(),
  html_content: z.string().min(1).optional(),
  text_content: z.string().optional(),
  target_type: z.enum(['all', 'tagged']).optional(),
  target_tags: z.array(z.string()).optional(),
});

// === SETTINGS ===

export const settingsUpdateSchema = z.object({
  email_enabled: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
  maintenance_message: z.string().max(2000).optional(),
  display_timezone: z.string().max(100).optional(),
  rate_limit_forms_max: z.number().int().min(1).max(1000).optional(),
  rate_limit_forms_window_minutes: z.number().int().min(1).max(1440).optional(),
});

export const menuUpdateSchema = z.object({
  nav_visible_media: z.boolean().optional(),
  nav_visible_contacts: z.boolean().optional(),
  nav_visible_waitlist: z.boolean().optional(),
  nav_visible_subscribers: z.boolean().optional(),
  nav_visible_campaigns: z.boolean().optional(),
  nav_visible_sites: z.boolean().optional(),
  nav_visible_stats: z.boolean().optional(),
  nav_visible_logs: z.boolean().optional(),
  nav_visible_email: z.boolean().optional(),
  nav_visible_email_templates: z.boolean().optional(),
  nav_visible_users: z.boolean().optional(),
});

// === SITES ===

const VALID_SCOPES = ['contact', 'waitlist'] as const;

export const siteCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200).trim(),
  domain: z.string().max(255).trim().optional(),
  description: z.string().max(500).trim().optional(),
  permissions: z.array(z.enum(VALID_SCOPES)).optional(),
});

export const sitePermissionsSchema = z.object({
  permissions: z.array(z.enum(VALID_SCOPES)).min(0),
});

export const siteToggleSchema = z.object({
  is_active: z.boolean(),
});

// === EMAIL ===

const emailRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const composeEmailSchema = z.object({
  to: z.array(emailRecipientSchema).min(1, 'At least one TO recipient is required'),
  cc: z.array(emailRecipientSchema).optional(),
  bcc: z.array(emailRecipientSchema).optional(),
  subject: z.string().min(1, 'Subject is required').max(500).trim(),
  body: z.string().min(1, 'Message body is required').max(100000).trim(),
});

export const emailTemplateUpdateSchema = z.object({
  html: z.string().min(1, 'html is required'),
});

export const credentialsUpdateSchema = z.object({
  email: z.object({
    active_provider: z.string().optional(),
    ahasend_api_key: z.string().optional(),
    ahasend_account_id: z.string().optional(),
    resend_api_key: z.string().optional(),
    from_address: z.string().optional(),
    display_name: z.string().optional(),
    notification_address: z.string().optional(),
  }).optional(),
  storage: z.object({
    s3_access_key_id: z.string().optional(),
    s3_secret_access_key: z.string().optional(),
    s3_bucket: z.string().optional(),
    s3_region: z.string().optional(),
  }).optional(),
});

export const verifyKeySchema = z.object({
  provider: z.string().min(1, 'provider is required'),
  api_key: z.string().min(1, 'api_key is required'),
});

// Shared ID param schema (for routes that parse params manually)
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
});

export const noteIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  noteId: z.string().regex(/^\d+$/, 'Note ID must be a number').transform(Number),
});
