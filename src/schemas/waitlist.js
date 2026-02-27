import { z } from 'zod';

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

export const waitlistListQuerySchema = z.object({
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

export const waitlistEmailSchema = z.object({
  email: z.string()
    .email('Invalid email address'),
});