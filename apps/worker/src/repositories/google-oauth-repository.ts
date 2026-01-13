/**
 * Google OAuth token repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface GoogleOAuthToken {
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export class GoogleOAuthRepository {
  constructor(private db: D1Database) {}

  /**
   * Find token by user email
   */
  async findByEmail(userEmail: string): Promise<GoogleOAuthToken | null> {
    const result = await this.db
      .prepare(
        `SELECT
          user_email as userEmail,
          access_token as accessToken,
          refresh_token as refreshToken,
          token_type as tokenType,
          expires_at as expiresAt,
          scope,
          created_at as createdAt,
          updated_at as updatedAt
         FROM google_oauth_tokens
         WHERE user_email = ?`
      )
      .bind(userEmail)
      .first<GoogleOAuthToken>();

    return result || null;
  }

  /**
   * Upsert (insert or update) OAuth tokens
   */
  async upsert(data: {
    userEmail: string;
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresAt: string;
    scope: string;
  }): Promise<GoogleOAuthToken> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO google_oauth_tokens
          (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_email) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          token_type = excluded.token_type,
          expires_at = excluded.expires_at,
          scope = excluded.scope,
          updated_at = excluded.updated_at`
      )
      .bind(
        data.userEmail,
        data.accessToken,
        data.refreshToken,
        data.tokenType,
        data.expiresAt,
        data.scope,
        now,
        now
      )
      .run();

    const result = await this.findByEmail(data.userEmail);
    if (!result) {
      throw new Error('Failed to upsert OAuth tokens');
    }
    return result;
  }

  /**
   * Update access token only (after refresh)
   */
  async updateAccessToken(
    userEmail: string,
    accessToken: string,
    expiresAt: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE google_oauth_tokens
         SET access_token = ?, expires_at = ?, updated_at = ?
         WHERE user_email = ?`
      )
      .bind(accessToken, expiresAt, now, userEmail)
      .run();
  }

  /**
   * Delete OAuth tokens (disconnect)
   */
  async delete(userEmail: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM google_oauth_tokens WHERE user_email = ?`)
      .bind(userEmail)
      .run();
  }
}
