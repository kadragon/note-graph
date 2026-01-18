import type { D1Database } from '@cloudflare/workers-types';
import { GoogleOAuthService } from '@worker/services/google-oauth-service';
import type { Env } from '@worker/types/env';
import { describe, expect, it } from 'vitest';

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

    it('includes drive.file scope for existing Drive integration', () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const url = service.getAuthorizationUrl();
      const params = new URL(url).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('https://www.googleapis.com/auth/drive.file');
    });

    it('includes both drive.file and calendar.readonly scopes', () => {
      const env = createEnv();
      const service = new GoogleOAuthService(env, {} as D1Database);

      const url = service.getAuthorizationUrl();
      const params = new URL(url).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('drive.file');
      expect(scope).toContain('calendar.readonly');
    });
  });
});
