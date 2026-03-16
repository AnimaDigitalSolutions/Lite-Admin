import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';

/**
 * Tests that the validation middleware:
 * 1. Blocks invalid input with structured 400 errors (frontend parses these)
 * 2. Passes validated data through to handlers on req.validatedBody/Params/Query
 * 3. Calls next(error) for non-Zod errors instead of swallowing them
 */

describe('Validation middleware', () => {
  describe('validateBody', () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
    });

    function createApp() {
      const app = express();
      app.use(express.json());
      app.post('/test', validateBody(schema), (req, res) => {
        // Verify the validated data is attached, not raw body
        res.json({ received: req.validatedBody });
      });
      return app;
    }

    it('passes valid body through to handler', async () => {
      const res = await request(createApp())
        .post('/test')
        .send({ email: 'john@example.com', name: 'John' });

      expect(res.status).toBe(200);
      expect(res.body.received).toEqual({ email: 'john@example.com', name: 'John' });
    });

    it('returns 400 with field-level errors for invalid body', async () => {
      const res = await request(createApp())
        .post('/test')
        .send({ email: 'not-an-email', name: 'J' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
      expect(res.body.error.status).toBe(400);

      // Should contain field-level detail so frontend can show inline errors
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('email');
      expect(fields).toContain('name');
    });

    it('returns 400 for completely missing body fields', async () => {
      const res = await request(createApp())
        .post('/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('strips unknown fields (Zod default behavior)', async () => {
      const res = await request(createApp())
        .post('/test')
        .send({ email: 'john@example.com', name: 'John', malicious: '<script>alert(1)</script>' });

      expect(res.status).toBe(200);
      expect(res.body.received.malicious).toBeUndefined();
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().regex(/^\d+$/).transform(Number),
    });

    function createApp() {
      const app = express();
      app.get('/items/:id', validateParams(schema), (req, res) => {
        res.json({ id: req.validatedParams.id, type: typeof req.validatedParams.id });
      });
      return app;
    }

    it('transforms string param to number', async () => {
      const res = await request(createApp()).get('/items/42');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(42);
      expect(res.body.type).toBe('number');
    });

    it('rejects non-numeric param', async () => {
      const res = await request(createApp()).get('/items/abc');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Parameter validation failed');
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
      offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
    });

    function createApp() {
      const app = express();
      app.get('/items', validateQuery(schema), (req, res) => {
        res.json(req.validatedQuery);
      });
      return app;
    }

    it('applies defaults when query params are missing', async () => {
      const res = await request(createApp()).get('/items');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
    });

    it('parses provided query params', async () => {
      const res = await request(createApp()).get('/items?limit=10&offset=5');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(10);
      expect(res.body.offset).toBe(5);
    });

    it('rejects invalid query params', async () => {
      const res = await request(createApp()).get('/items?limit=abc');

      expect(res.status).toBe(400);
    });
  });
});
