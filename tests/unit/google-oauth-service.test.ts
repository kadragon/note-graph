import type { D1Database } from '@cloudflare/workers-types';
import { GoogleOAuthService, hasSufficientDriveScope } from '@worker/services/google-oauth-service';
import type { Env } from '@worker/types/env';
import { DomainError } from '@worker/types/errors';
import { describe, expect, it, vi } from 'vitest';

describe('GoogleOAuthService', () => {
  const createEnv = (): Env =>
    ({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
    }) as Env;

  describe('getAuthorizationUrl', () => {
    it('includes calendar.readonly scope', () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const url = service.getAuthorizationUrl();
      const params = new URL(url).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });

    it('includes drive scope for full Drive access', () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const url = service.getAuthorizationUrl();
      const params = new URL(url).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('https://www.googleapis.com/auth/drive');
    });

    it('includes both drive and calendar.readonly scopes', () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const url = service.getAuthorizationUrl();
      const params = new URL(url).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('drive');
      expect(scope).toContain('calendar.readonly');
    });
  });

  describe('hasSufficientDriveScope', () => {
    it('returns true for full drive scope', () => {
      expect(
        hasSufficientDriveScope(
          'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.readonly'
        )
      ).toBe(true);
    });

    it('returns false for limited drive.file scope', () => {
      expect(
        hasSufficientDriveScope(
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly'
        )
      ).toBe(false);
    });

    it('returns false for null scope', () => {
      expect(hasSufficientDriveScope(null)).toBe(false);
    });

    it('returns false for undefined scope', () => {
      expect(hasSufficientDriveScope(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasSufficientDriveScope('')).toBe(false);
    });

    it('returns true for drive scope only', () => {
      expect(hasSufficientDriveScope('https://www.googleapis.com/auth/drive')).toBe(true);
    });
  });

  describe('refreshAccessToken', () => {
    it('does not treat invalid_grant in description when error code differs', async () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'invalid_token',
            error_description: 'invalid_grant',
          }),
          { status: 400 }
        )
      );

      let thrown: unknown;
      try {
        await service.refreshAccessToken('invalid-refresh-token');
      } catch (error) {
        thrown = error;
      } finally {
        fetchSpy.mockRestore();
      }

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown).not.toBeInstanceOf(DomainError);
      expect((thrown as Error).message).toContain('Failed to refresh access token');
    });
  });
});
