import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
  errors?: unknown;
  code?: string;
}

const errorHandler = (err: CustomError, req: Request, res: Response, _next: NextFunction) => {
  // Log error details
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Prepare error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal server error',
      status: statusCode,
    },
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as CustomError).stack = err.stack;
    (errorResponse.error as CustomError).details = err.details || null;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    errorResponse.error.message = 'Validation failed';
    (errorResponse.error as CustomError).details = err.errors;
  } else if (err.name === 'UnauthorizedError') {
    errorResponse.error.message = 'Unauthorized access';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    errorResponse.error.message = 'File size exceeds limit';
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;