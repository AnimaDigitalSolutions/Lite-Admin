import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  company: z.string()
    .max(100, 'Company name must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  
  project_type: z.enum(['web', 'mobile', 'erp', 'consulting', 'other'])
    .optional()
    .nullable(),
  
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
});

export const contactListQuerySchema = z.object({
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
});

export const contactIdSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a number')
    .transform(Number),
});

export const contactTestEmailSchema = z.object({
  test_email: z.string()
    .email('Invalid test email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  company: z.string()
    .max(100, 'Company name must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  
  project_type: z.enum(['web', 'mobile', 'erp', 'consulting', 'other'])
    .optional()
    .nullable(),
  
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
});