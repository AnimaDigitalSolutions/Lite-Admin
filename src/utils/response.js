// Standardized API response helpers

export const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const errorResponse = (message, status = 500, details = null) => ({
  success: false,
  error: {
    message,
    status,
    details,
    timestamp: new Date().toISOString(),
  },
});

export const paginatedResponse = (data, pagination) => ({
  success: true,
  data,
  pagination: {
    ...pagination,
    hasMore: data.length === pagination.limit,
  },
  timestamp: new Date().toISOString(),
});