// Standardized API response helpers

interface PaginationInfo {
  limit?: number;
  offset?: number;
  total?: number;
}

export const successResponse = (data: unknown, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const errorResponse = (message: string, status = 500, details = null) => ({
  success: false,
  error: {
    message,
    status,
    details,
    timestamp: new Date().toISOString(),
  },
});

export const paginatedResponse = (data: unknown[], pagination: PaginationInfo) => ({
  success: true,
  data,
  pagination: {
    ...pagination,
    hasMore: data.length === pagination.limit,
  },
  timestamp: new Date().toISOString(),
});