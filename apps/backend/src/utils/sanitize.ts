// Input sanitization helpers

/**
 * Remove HTML tags from string
 */
export const stripHtml = (input: string) => {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>?/gm, '');
};

/**
 * Escape HTML entities
 */
export const escapeHtml = (input: string) => {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return input.replace(/[&<>"']/g, (m) => map[m as keyof typeof map]);
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename: string) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
};

/**
 * Sanitize object recursively
 */
interface SanitizeOptions {
  stripTags?: boolean;
  escapeEntities?: boolean;
}

export const sanitizeObject = (obj: unknown, options: SanitizeOptions = {}): unknown => {
  const { stripTags = true, escapeEntities = false } = options;
  
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      let result = obj;
      if (stripTags) result = stripHtml(result);
      if (escapeEntities) result = escapeHtml(result);
      return result;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value, options);
  }
  
  return sanitized;
};