/**
 * Google OAuth token repository for database operations
 */

import type { DatabaseClient } from '../types/database';

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
  constructor(private db: DatabaseClient) {}

  /**
   * Find token by user email
   */
  async findByEmail(userEmail: string): Promise<GoogleOAuthToken | null> {
    return this.db.queryOne<GoogleOAuthToken>(
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
       WHERE user_email = ?`,
      [userEmail]
    );
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

    await this.db.execute(
      `INSERT INTO google_oauth_tokens
        (user_email, access_token, refresh_token, token_type, expires_at, scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_email) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_type = excluded.token_type,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        updated_at = excluded.updated_at`,
      [
        data.userEmail,
        data.accessToken,
        data.refreshToken,
        data.tokenType,
        data.expiresAt,
        data.scope,
        now,
        now,
      ]
    );

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

    await this.db.execute(
      `UPDATE google_oauth_tokens
       SET access_token = ?, expires_at = ?, updated_at = ?
       WHERE user_email = ?`,
      [accessToken, expiresAt, now, userEmail]
    );
  }

  /**
   * Delete OAuth tokens (disconnect)
   */
  async delete(userEmail: string): Promise<void> {
    await this.db.execute(`DELETE FROM google_oauth_tokens WHERE user_email = ?`, [userEmail]);
  }
}
