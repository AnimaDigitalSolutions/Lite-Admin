// Date utilities
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// String utilities
export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// File utilities
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    // Use typeof check for browser/node compatibility
    if (typeof URL !== 'undefined') {
      new URL(url);
    } else {
      // Fallback for environments without URL
      const urlRegex = /^https?:\/\/.+/;
      return urlRegex.test(url);
    }
    return true;
  } catch {
    return false;
  }
};

// API utilities
export const createApiResponse = <T>(
  data?: T,
  success = true,
  error?: { message: string; status?: number }
) => {
  return {
    success,
    data,
    error,
    timestamp: new Date().toISOString(),
  };
};

export const createPaginatedResponse = <T>(
  data: T[],
  pagination: { limit: number; offset: number; total?: number }
) => {
  return {
    success: true,
    data,
    pagination: {
      ...pagination,
      hasMore: data.length === pagination.limit,
    },
    timestamp: new Date().toISOString(),
  };
};

// Error utilities
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    // Only capture stack trace if available (Node.js)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Constants
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const PROJECT_TYPES = [
  'web',
  'mobile',
  'erp',
  'consulting',
  'other',
] as const;

export const USER_ROLES = ['admin', 'super_admin'] as const;