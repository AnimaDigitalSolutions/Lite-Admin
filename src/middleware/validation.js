import { z } from 'zod';
import logger from '../utils/logger.js';

const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // Attach validated data to request
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({
          message: 'Validation failed',
          errors: error.errors,
          url: req.url,
          method: req.method,
        });
        
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            status: 400,
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }
      
      next(error);
    }
  };
};

// Simplified validation for body only
const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      const validatedData = await schema.parseAsync(req.body);
      req.validatedBody = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({
          message: 'Body validation failed',
          errors: error.errors,
          url: req.url,
          method: req.method,
        });
        
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            status: 400,
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }
      
      next(error);
    }
  };
};

// Validation for query parameters only
const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const validatedData = await schema.parseAsync(req.query);
      req.validatedQuery = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({
          message: 'Query validation failed',
          errors: error.errors,
          url: req.url,
          method: req.method,
        });
        
        return res.status(400).json({
          error: {
            message: 'Query validation failed',
            status: 400,
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }
      
      next(error);
    }
  };
};

// Validation for route parameters only
const validateParams = (schema) => {
  return async (req, res, next) => {
    try {
      const validatedData = await schema.parseAsync(req.params);
      req.validatedParams = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({
          message: 'Params validation failed',
          errors: error.errors,
          url: req.url,
          method: req.method,
        });
        
        return res.status(400).json({
          error: {
            message: 'Parameter validation failed',
            status: 400,
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }
      
      next(error);
    }
  };
};

export { validate, validateBody, validateQuery, validateParams };
export default validate;