import { z } from 'zod';

export const invoiceListQuerySchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('50'),

  offset: z.string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform(Number)
    .refine((n) => n >= 0, 'Offset must be non-negative')
    .optional()
    .default('0'),

  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
    .optional(),
});

export const invoiceIdSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a number')
    .transform(Number),
});

const lineItemSchema = z.object({
  description: z.string().min(1).max(500).trim(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
});

export const invoiceCreateSchema = z.object({
  invoice_number: z.string().max(50).trim().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  currency: z.string().max(3).default('USD'),
  tax_rate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).default(0),
  notes: z.string().max(2000).trim().optional().nullable(),
  due_date: z.string().optional().nullable(),
  issued_date: z.string().optional().nullable(),
  // Client info
  client_name: z.string().max(200).trim().optional().nullable(),
  client_email: z.string().email().max(255).trim().toLowerCase().optional().nullable(),
  client_address: z.string().max(500).trim().optional().nullable(),
  // Company info
  company_name: z.string().max(200).trim().optional().nullable(),
  company_email: z.string().email().max(255).trim().toLowerCase().optional().nullable(),
  company_address: z.string().max(500).trim().optional().nullable(),
  company_phone: z.string().max(50).trim().optional().nullable(),
  company_logo_url: z.string().max(500).trim().optional().nullable(),
  // Template
  template: z.string().max(50).default('classic'),
  // Line items
  items: z.array(lineItemSchema).default([]),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();
