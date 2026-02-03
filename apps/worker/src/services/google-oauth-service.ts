/**
 * Google OAuth service for handling authentication flow
 */

import {
  GoogleOAuthRepository,
  type GoogleOAuthToken,
} from '../repositories/google-oauth-repository';
import type { Env } from '../types/env';
import { DomainError } from '../types/errors';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// Request full access to Google Drive (needed to see files added directly to Drive folders)
// and read-only calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// Required scope for full Drive access (used to detect if re-auth is needed)
const REQUIRED_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/**
 * Check if the stored scope includes the required full drive scope.
 * Returns true if full 'drive' scope is present (regardless of whether 'drive.file' is also present).
 * This handles the case where Google returns both scopes after re-auth.
 */
export function hasSufficientDriveScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  const scopes = scope.split(' ');
  // Full drive scope is sufficient - if present, user has full access
  // even if drive.file is also in the scope list (can happen after re-auth)
  // Using explicit equality check (===) to avoid CodeQL false positive about URL substring matching
  return scopes.some((s) => s === REQUIRED_DRIVE_SCOPE);
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

export class GoogleOAuthService {
  private repository: GoogleOAuthRepository;

  constructor(
    private env: Env,
    db: D1Database
  ) {
    this.repository = new GoogleOAuthRepository(db);
  }

  /**
   * Generate authorization URL for OAuth consent screen
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Always show consent to get refresh token
    });

    if (state) {
      params.set('state', state);
    }

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: { error?: string } | undefined;
      try {
        errorJson = JSON.parse(errorText) as { error?: string };
      } catch {
        // Not a JSON response.
      }
      // Check for invalid_grant error (token expired or revoked)
      if (errorJson?.error === 'invalid_grant') {
        throw new DomainError(
          'Google 인증이 만료되었습니다. 다시 연결해 주세요.',
          'GOOGLE_TOKEN_EXPIRED',
          401
        );
      }
      throw new Error(`Failed to refresh access token: ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Store OAuth tokens in database
   */
  async storeTokens(userEmail: string, tokens: OAuthTokens): Promise<void> {
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    await this.repository.upsert({
      userEmail,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresAt,
      scope: tokens.scope,
    });
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(userEmail: string): Promise<string> {
    const storedTokens = await this.repository.findByEmail(userEmail);

    if (!storedTokens) {
      throw new Error('Google account not connected. Please authorize first.');
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(storedTokens.expiresAt);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - bufferMs <= now.getTime()) {
      // Token expired or about to expire, refresh it
      const refreshed = await this.refreshAccessToken(storedTokens.refreshToken);
      const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

      await this.repository.updateAccessToken(userEmail, refreshed.accessToken, newExpiresAt);

      return refreshed.accessToken;
    }

    return storedTokens.accessToken;
  }

  /**
   * Get stored tokens (for checking connection status)
   */
  async getStoredTokens(userEmail: string): Promise<GoogleOAuthToken | null> {
    return this.repository.findByEmail(userEmail);
  }

  /**
   * Revoke tokens and disconnect account
   */
  async disconnect(userEmail: string): Promise<void> {
    const storedTokens = await this.repository.findByEmail(userEmail);

    if (storedTokens) {
      // Revoke the token at Google
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${storedTokens.accessToken}`, {
          method: 'POST',
        });
      } catch {
        // Ignore revoke errors, still delete from our DB
      }

      // Delete from our database
      await this.repository.delete(userEmail);
    }
  }
}
