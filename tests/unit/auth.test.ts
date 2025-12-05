// Unit tests for authentication middleware and handlers

import { env } from 'cloudflare:test';
import type { AuthUser } from '@shared/types/auth';
import { AuthenticationError } from '@shared/types/auth';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { getMeHandler } from '@/handlers/auth';
import { authMiddleware, getAuthUser } from '@/middleware/auth';
import type { Env } from '@/types/env';

const testEnv = env as unknown as Env;

describe('Authentication Middleware', () => {
  describe('authMiddleware()', () => {
    let app: Hono<{ Bindings: Env; Variables: { user: AuthUser } }>;

    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

      // Add error handler for authentication errors
      app.onError((err, c) => {
        if (err instanceof AuthenticationError) {
          return c.json({ code: 'UNAUTHORIZED', message: err.message }, 401);
        }
        return c.json({ error: 'Internal Server Error' }, 500);
      });

      app.use('*', authMiddleware);
      app.get('/test', (c) => {
        const user = c.get('user');
        return c.json({ user });
      });
    });

    it('should authenticate with Cloudflare Access header', async () => {
      // Arrange
      const email = 'test@example.com';

      // Act
      const response = await app.request(
        '/test',
        {
          headers: {
            'cf-access-authenticated-user-email': email,
          },
        },
        testEnv
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe(email);
    });

    it('should normalize email to lowercase and trim whitespace', async () => {
      // Arrange
      const email = '  TEST@EXAMPLE.COM  ';

      // Act
      const response = await app.request(
        '/test',
        {
          headers: {
            'cf-access-authenticated-user-email': email,
          },
        },
        testEnv
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
    });

    it('should authenticate with test header in development mode', async () => {
      // Arrange
      const email = 'dev@example.com';
      const devEnv = { ...testEnv, ENVIRONMENT: 'development' };

      // Act
      const response = await app.request(
        '/test',
        {
          headers: {
            'x-test-user-email': email,
          },
        },
        devEnv
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe(email);
    });

    it('should use default test user when no headers are provided in development mode', async () => {
      // Arrange
      const devEnv = { ...testEnv, ENVIRONMENT: 'development' };

      // Act
      const response = await app.request('/test', {}, devEnv);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe('dev@localhost');
    });

    it('should reject when no authentication header is provided (production)', async () => {
      // Act
      const prodEnv = { ...testEnv, ENVIRONMENT: 'production' };
      const response = await app.request('/test', {}, prodEnv);

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject test header in production mode', async () => {
      // Arrange
      const prodEnv = { ...testEnv, ENVIRONMENT: 'production' };

      // Act
      const response = await app.request(
        '/test',
        {
          headers: {
            'x-test-user-email': 'test@example.com',
          },
        },
        prodEnv
      );

      // Assert
      expect(response.status).toBe(401);
    });

    it('should prefer Cloudflare Access header over test header', async () => {
      // Arrange
      const cfEmail = 'cf@example.com';
      const testEmail = 'test@example.com';
      const devEnv = { ...testEnv, ENVIRONMENT: 'development' };

      // Act
      const response = await app.request(
        '/test',
        {
          headers: {
            'cf-access-authenticated-user-email': cfEmail,
            'x-test-user-email': testEmail,
          },
        },
        devEnv
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe(cfEmail);
    });
  });

  describe('getAuthUser()', () => {
    it('should return authenticated user from context', async () => {
      // Arrange
      const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();
      app.get('/test', (c) => {
        c.set('user', { email: 'test@example.com', name: 'Test User' });
        const user = getAuthUser(c);
        return c.json({ user });
      });

      // Act
      const response = await app.request('/test', {}, testEnv);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.name).toBe('Test User');
    });

    it('should throw error when user is not in context', async () => {
      // Arrange
      const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();
      app.get('/test', (c) => {
        // Try to get user without setting it
        expect(() => getAuthUser(c)).toThrow('User not found in context');
        return c.json({ ok: true });
      });

      // Act
      await app.request('/test', {}, testEnv);
    });
  });
});

describe('Authentication Handlers', () => {
  describe('getMeHandler()', () => {
    let app: Hono<{ Bindings: Env; Variables: { user: AuthUser } }>;

    beforeEach(() => {
      app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

      // Add error handler for authentication errors
      app.onError((err, c) => {
        if (err instanceof AuthenticationError) {
          return c.json({ code: 'UNAUTHORIZED', message: err.message }, 401);
        }
        return c.json({ error: 'Internal Server Error' }, 500);
      });

      app.use('*', authMiddleware);
      app.get('/me', getMeHandler);
    });

    it('should return current user information', async () => {
      // Arrange
      const email = 'test@example.com';

      // Act
      const response = await app.request(
        '/me',
        {
          headers: {
            'cf-access-authenticated-user-email': email,
          },
        },
        testEnv
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe(email);
      expect(data.name).toBeNull(); // name is undefined in middleware, becomes null in handler
    });

    it('should require authentication (production)', async () => {
      // Act
      const prodEnv = { ...testEnv, ENVIRONMENT: 'production' };
      const response = await app.request('/me', {}, prodEnv);

      // Assert
      expect(response.status).toBe(401);
    });

    it('should handle user with name', async () => {
      // Arrange
      const app2 = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();
      app2.get('/me', (c) => {
        // Manually set user with name for this test
        c.set('user', { email: 'test@example.com', name: 'Test User' });
        return getMeHandler(c);
      });

      // Act
      const response = await app2.request('/me', {}, testEnv);

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe('test@example.com');
      expect(data.name).toBe('Test User');
    });
  });
});
