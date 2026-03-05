import { z } from 'zod';

export const mediaUploadSchema = z.object({
  project_name: z.string()
    .max(100, 'Project name must be less than 100 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
});

export const mediaUpdateSchema = z.object({
  project_name: z.string()
    .max(100, 'Project name must be less than 100 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
});

export const mediaListQuerySchema = z.object({
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
  
  project: z.string()
    .max(100)
    .optional(),
});

export const mediaIdSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a number')
    .transform(Number),
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