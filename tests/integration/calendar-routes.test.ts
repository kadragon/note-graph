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
  });
});
