// User and Authentication Types
export interface AdminUser {
  id: number;
  email: string;
  name?: string;
  role: 'admin' | 'super_admin';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface JWTPayload {
  id: number;
  email: string;
  role: string;
  exp?: number;
  iat?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<AdminUser, 'passwordHash'>;
}

// Form Submission Types
export interface Contact {
  id: number;
  name: string;
  email: string;
  company?: string;
  projectType?: 'web' | 'mobile' | 'erp' | 'consulting' | 'other';
  message: string;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface WaitlistEntry {
  id: number;
  email: string;
  name?: string;
  tags?: string;
  signedUpAt: Date;
  ipAddress?: string;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  preheader?: string;
  htmlContent: string;
  textContent?: string;
  status: 'draft' | 'sent';
  recipientCount?: number;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Media Types
export interface MediaItem {
  id: number;
  filename: string;
  originalName: string;
  projectName?: string;
  description?: string;
  fileSize: number;
  width?: number;
  height?: number;
  mimeType: string;
  storageProvider: 'local' | 's3';
  storagePath: string;
  url?: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

export interface MediaUploadRequest {
  projectName?: string;
  description?: string;
}

// Admin Activity Types
export interface AdminLog {
  id: number;
  action: string;
  resource: string;
  resourceId?: number;
  details?: string;
  ipAddress?: string;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    status: number;
    details?: any;
  };
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Configuration Types
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres' | 'mysql';
  path?: string;
  url?: string;
}

export interface EmailConfig {
  provider: 'ahasend' | 'resend';
  from: string;
  ahasend?: {
    apiKey: string;
    accountId?: string;
  };
  resend?: {
    apiKey: string;
  };
}

export interface StorageConfig {
  provider: 'local' | 's3';
  local?: {
    uploadDir: string;
  };
  s3?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
  };
}

// Contact Note Types
export type NoteSubtype = 'note' | 'todo' | 'message' | 'reply';

export interface ContactNote {
  id: number;
  contactId: number;
  content: string;
  type: 'manual' | 'system';
  subtype?: NoteSubtype;
  color?: string;
  dueAt?: string | null;
  isDone?: boolean;
  createdAt: Date;
}

// Invoice Types
export interface Invoice {
  id: number;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes?: string;
  dueDate?: string;
  issuedDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  companyName?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
  template: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Site Types
export interface Site {
  id: number;
  name: string;
  domain?: string;
  description?: string;
  apiKey: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Contact Status Types
export const CONTACT_STATUSES = [
  'new', 'reviewed', 'contacted', 'qualified',
  'proposal_sent', 'won', 'lost', 'archived',
] as const;

export type ContactStatus = typeof CONTACT_STATUSES[number];

// Statistics Types
export interface SystemStats {
  contacts: {
    total: number;
    recent?: Date;
  };
  waitlist: {
    total: number;
    recent?: Date;
  };
  media: {
    total: number;
    totalSize?: number;
    recent?: Date;
  };
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    nodeVersion: string;
  };
}