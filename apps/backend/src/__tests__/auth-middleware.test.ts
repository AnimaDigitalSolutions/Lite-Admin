import express from 'express';
import request from 'supertest';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { jwtService } from '../services/auth/jwt.service.js';

/**
 * Tests that auth middleware correctly gates access:
 * - No token → 401
 * - Invalid/expired token → 401
 * - Valid token, wrong role → 403
 * - Valid admin token → passes through
 *
 * These are critical because a bug here = unauthorized access to admin endpoints.
 */

function createAuthApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authenticate, (req, res) => {
    res.json({ user: req.user });
  });
  return app;
}

function createAdminApp() {
  const app = express();
  app.use(express.json());
  app.get('/admin', requireAdmin, (req, res) => {
    res.json({ user: req.user });
  });
  return app;
}

describe('Auth middleware', () => {
  describe('authenticate', () => {
    it('rejects request with no token', async () => {
      const res = await request(createAuthApp()).get('/protected');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Authorization required');
    });

    it('rejects request with invalid Bearer token', async () => {
      const res = await request(createAuthApp())
        .get('/protected')
        .set('Authorization', 'Bearer garbage.token.here');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid token');
    });

    it('accepts valid Bearer token and attaches user to req', async () => {
      const { accessToken: token } = jwtService.generateTokens({ id: 1, email: 'admin@test.com', role: 'admin' });

      const res = await request(createAuthApp())
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('admin');
    });

    it('accepts token from accessToken cookie', async () => {
      const { accessToken: token } = jwtService.generateTokens({ id: 1, email: 'admin@test.com', role: 'admin' });

      const app = express();
      const cookieParser = (await import('cookie-parser')).default;
      app.use(cookieParser());
      app.get('/protected', authenticate, (req, res) => {
        res.json({ user: req.user });
      });

      const res = await request(app)
        .get('/protected')
        .set('Cookie', `accessToken=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@test.com');
    });
  });

  describe('requireAdmin', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(createAdminApp()).get('/admin');

      expect(res.status).toBe(401);
    });

    it('allows admin role through', async () => {
      const { accessToken: token } = jwtService.generateTokens({ id: 1, email: 'admin@test.com', role: 'admin' });

      const res = await request(createAdminApp())
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('allows super_admin role through', async () => {
      const { accessToken: token } = jwtService.generateTokens({ id: 1, email: 'super@test.com', role: 'super_admin' });

      const res = await request(createAdminApp())
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('blocks non-admin role with 403', async () => {
      // Force a non-admin role past the type system — this simulates a token
      // issued before a role downgrade, or a tampered-but-valid-signature edge case
      const { accessToken: token } = jwtService.generateTokens(
        { id: 2, email: 'user@test.com', role: 'viewer' as 'admin' }
      );

      const res = await request(createAdminApp())
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Admin access required');
    });
  });
});
