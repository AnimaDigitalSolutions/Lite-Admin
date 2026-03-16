import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@lite/shared';
import logger from '../utils/logger.js';

interface LegacyError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
  errors?: unknown;
  code?: string;
}

const errorHandler = (err: LegacyError, req: Request, res: Response, _next: NextFunction) => {
  // Log error details
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Determine status code — AppError subclasses carry their own statusCode
  const statusCode = err instanceof AppError
    ? err.statusCode
    : (err.statusCode || err.status || 500);

  // Prepare error response
  const errorResponse: {
    error: {
      message: string;
      status: number;
      details?: unknown;
      stack?: string;
    };
  } = {
    error: {
      message: err.message || 'Internal server error',
      status: statusCode,
    },
  };

  // Attach details from AppError subclasses or legacy errors
  if (err instanceof AppError && err.details) {
    errorResponse.error.details = err.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    if (!(err instanceof AppError) && (err.details || err.errors)) {
      errorResponse.error.details = err.details || err.errors;
    }
  }

  // Handle legacy error types by name (for backwards compatibility)
  if (!(err instanceof AppError)) {
    if (err.name === 'ValidationError') {
      errorResponse.error.message = 'Validation failed';
      errorResponse.error.details = err.errors;
    } else if (err.name === 'UnauthorizedError') {
      errorResponse.error.message = 'Unauthorized access';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      errorResponse.error.message = 'File size exceeds limit';
    }
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;
