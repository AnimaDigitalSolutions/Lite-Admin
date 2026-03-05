// Custom validation helpers

/**
 * Validate email format
 */
export const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate file type
 */
export const isValidFileType = (mimetype: string, allowedTypes: string[]) => {
  return allowedTypes.includes(mimetype);
};

/**
 * Validate file size
 */
export const isValidFileSize = (size: number, maxSize: number) => {
  return size <= maxSize;
};

/**
 * Validate string length
 */
export const isValidLength = (str: string, min = 0, max = Infinity) => {
  const length = str?.length || 0;
  return length >= min && length <= max;
};

/**
 * Sanitize and validate phone number
 */
export const sanitizePhoneNumber = (phone: string) => {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid length (10-15 digits internationally)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  
  return cleaned;
};

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export const isEmpty = (value: any) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
};