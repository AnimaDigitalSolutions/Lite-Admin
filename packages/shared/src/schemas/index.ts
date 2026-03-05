import { z } from 'zod';

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Contact Form Schemas
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
  
  projectType: z.enum(['web', 'mobile', 'erp', 'consulting', 'other'])
    .optional()
    .nullable(),
  
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters')
    .trim(),
});

// Waitlist Schemas
export const waitlistSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
});

// Media Schemas
export const mediaUploadSchema = z.object({
  projectName: z.string()
    .max(100, 'Project name must be less than 100 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
});

export const mediaUpdateSchema = z.object({
  projectName: z.string()
    .max(100, 'Project name must be less than 100 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
});

// Query Schemas
export const paginationSchema = z.object({
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

export const idParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a number')
    .transform(Number),
});

export const mediaQuerySchema = paginationSchema.extend({
  project: z.string()
    .max(100)
    .optional(),
});

export const thumbnailQuerySchema = z.object({
  width: z.string()
    .regex(/^\d+$/, 'Width must be a number')
    .transform(Number)
    .refine((n) => n > 0 && n <= 2000, 'Width must be between 1 and 2000')
    .optional(),
  
  height: z.string()
    .regex(/^\d+$/, 'Height must be a number')
    .transform(Number)
    .refine((n) => n > 0 && n <= 2000, 'Height must be between 1 and 2000')
    .optional(),
  
  quality: z.string()
    .regex(/^\d+$/, 'Quality must be a number')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, 'Quality must be between 1 and 100')
    .optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type MediaQuery = z.infer<typeof mediaQuerySchema>;
export type ThumbnailQuery = z.infer<typeof thumbnailQuerySchema>;