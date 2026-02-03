/**
 * Integration tests for calendar API routes
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Calendar API Routes', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();

    // Clean up test data
    await testEnv.DB.prepare('DELETE FROM google_oauth_tokens').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/calendar/events', () => {
    it('should require authentication', async () => {
      const response = await SELF.fetch(
        'http://localhost/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(401);
    });

    it('should return 400 when startDate is missing', async () => {
      const response = await authFetch('/api/calendar/events?endDate=2026-02-01');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when endDate is missing', async () => {
      const response = await authFetch('/api/calendar/events?startDate=2026-01-19');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when Google account is not connected', async () => {
      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('GOOGLE_NOT_CONNECTED');
    });

    it('should return 400 when stored token lacks calendar scope', async () => {
      // Setup: Add OAuth token with only Drive scope (no calendar)
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'test-access-token',
          'test-refresh-token',
          'Bearer',
          new Date(Date.now() + 3600000).toISOString(),
          'https://www.googleapis.com/auth/drive' // No calendar scope
        )
        .run();

      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('GOOGLE_NOT_CONNECTED');
      expect(data.message).toContain('calendar');
    });

    it('should return 401 with GOOGLE_TOKEN_EXPIRED when refresh token is invalid', async () => {
      // Setup: Add OAuth token with expired access token (to trigger refresh)
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'expired-access-token',
          'invalid-refresh-token',
          'Bearer',
          new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
          'https://www.googleapis.com/auth/calendar.readonly'
        )
        .run();

      // Mock fetch to return invalid_grant error from Google OAuth token endpoint
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Token has been expired or revoked.',
            }),
            { status: 400 }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('GOOGLE_TOKEN_EXPIRED');
    });

    it('should return 400 with GOOGLE_NOT_CONNECTED when Calendar API returns 403', async () => {
      // Setup: Add OAuth token with calendar scope
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'test-access-token',
          'test-refresh-token',
          'Bearer',
          new Date(Date.now() + 3600000).toISOString(),
          'https://www.googleapis.com/auth/calendar.readonly'
        )
        .run();

      // Mock fetch to return 403 from Google Calendar API
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.includes('googleapis.com/calendar/v3')) {
          return new Response(
            JSON.stringify({
              error: {
                code: 403,
                message: 'Access denied',
                status: 'PERMISSION_DENIED',
              },
            }),
            { status: 403 }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('GOOGLE_NOT_CONNECTED');
    });

    it('should return calendar events when Google account is connected', async () => {
      // Setup: Add OAuth token
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'test-access-token',
          'test-refresh-token',
          'Bearer',
          new Date(Date.now() + 3600000).toISOString(),
          'https://www.googleapis.com/auth/calendar.readonly'
        )
        .run();

      // Mock fetch for Google Calendar API
      const mockEvents = {
        items: [
          {
            id: 'event-1',
            summary: 'Test Meeting',
            start: { dateTime: '2026-01-20T10:00:00+09:00' },
            end: { dateTime: '2026-01-20T11:00:00+09:00' },
            htmlLink: 'https://calendar.google.com/event/1',
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.includes('googleapis.com/calendar/v3')) {
          return new Response(JSON.stringify(mockEvents), { status: 200 });
        }
        // Fall through to actual fetch for other URLs
        return new Response('Not Found', { status: 404 });
      });

      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(1);
      expect(data.events[0].summary).toBe('Test Meeting');
    });

    it('should return 400 when timezoneOffset is invalid', async () => {
      // Setup: Add OAuth token with calendar scope
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'test-access-token',
          'test-refresh-token',
          'Bearer',
          new Date(Date.now() + 3600000).toISOString(),
          'https://www.googleapis.com/auth/calendar.readonly'
        )
        .run();

      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01&timezoneOffset=abc'
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should use timezone offset for correct local time bounds', async () => {
      // Setup: Add OAuth token with calendar scope
      await testEnv.DB.prepare(`
        INSERT INTO google_oauth_tokens (
          user_email, access_token, refresh_token, token_type, expires_at, scope
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(
          'test@example.com',
          'test-access-token',
          'test-refresh-token',
          'Bearer',
          new Date(Date.now() + 3600000).toISOString(),
          'https://www.googleapis.com/auth/calendar.readonly'
        )
        .run();

      let capturedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.includes('googleapis.com/calendar/v3')) {
          capturedUrl = url;
          return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      });

      // Request with KST timezone offset (+540 minutes = +09:00)
      const response = await authFetch(
        '/api/calendar/events?startDate=2026-01-19&endDate=2026-02-01&timezoneOffset=540'
      );

      expect(response.status).toBe(200);

      // Verify timeMin/timeMax use the correct timezone offset
      const urlParams = new URL(capturedUrl).searchParams;
      const timeMin = urlParams.get('timeMin');
      const timeMax = urlParams.get('timeMax');

      // timeMin should be 2026-01-19T00:00:00+09:00 (KST midnight)
      // In UTC: 2026-01-18T15:00:00.000Z
      expect(timeMin).toBe('2026-01-18T15:00:00.000Z');

      // timeMax should be 2026-02-01T23:59:59+09:00 (KST end of day)
      // In UTC: 2026-02-01T14:59:59.000Z
      expect(timeMax).toBe('2026-02-01T14:59:59.000Z');
    });
  });
});
