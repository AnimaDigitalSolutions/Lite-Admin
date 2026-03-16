import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '../errors.js';
import errorHandler from '../middleware/errorHandler.js';

/**
 * Tests that the error handler middleware produces the correct HTTP responses
 * for each error class. This matters because the frontend parses these response
 * shapes — if the format changes, the admin dashboard breaks silently.
 */

function createTestApp(throwFn: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.get('/test', throwFn);
  app.use(errorHandler);
  return app;
}

describe('Error handler middleware', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('returns 500 with message for generic AppError', async () => {
    const app = createTestApp((_req, _res, next) => next(new AppError('DB connection lost')));

    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('DB connection lost');
    expect(res.body.error.status).toBe(500);
  });

  it('returns 400 with details for ValidationError', async () => {
    const details = [{ field: 'email', message: 'Invalid format' }];
    const app = createTestApp((_req, _res, next) => next(new ValidationError('Bad input', details)));

    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Bad input');
    expect(res.body.error.details).toEqual(details);
  });

  it('returns 404 for NotFoundError', async () => {
    const app = createTestApp((_req, _res, next) => next(new NotFoundError('Invoice not found')));

    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Invoice not found');
  });

  it('returns 401 for UnauthorizedError', async () => {
    const app = createTestApp((_req, _res, next) => next(new UnauthorizedError()));

    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Unauthorized access');
  });

  it('returns 403 for ForbiddenError', async () => {
    const app = createTestApp((_req, _res, next) => next(new ForbiddenError()));

    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Access forbidden');
  });

  it('handles legacy errors with statusCode property', async () => {
    const app = createTestApp((_req, _res, next) => {
      const err = new Error('Rate limited') as Error & { statusCode: number };
      err.statusCode = 429;
      next(err);
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe('Rate limited');
  });

  it('handles multer LIMIT_FILE_SIZE errors', async () => {
    const app = createTestApp((_req, _res, next) => {
      const err = new Error('File too large') as Error & { code: string; statusCode: number };
      err.code = 'LIMIT_FILE_SIZE';
      err.statusCode = 413;
      next(err);
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(413);
    expect(res.body.error.message).toBe('File size exceeds limit');
  });

  it('defaults to 500 for bare Error with no statusCode', async () => {
    const app = createTestApp((_req, _res, next) => next(new Error('Something unexpected')));

    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Something unexpected');
  });

  it('does NOT leak stack traces in production', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp((_req, _res, next) => next(new AppError('Oops')));

    const res = await request(app).get('/test');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('includes stack traces in development', async () => {
    process.env.NODE_ENV = 'development';
    const app = createTestApp((_req, _res, next) => next(new AppError('Oops')));

    const res = await request(app).get('/test');
    expect(res.body.error.stack).toBeDefined();
    expect(res.body.error.stack).toContain('AppError');
  });
});
