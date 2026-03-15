/**
 * Google OAuth routes for Drive integration
 */

import { getAuthUser } from '../middleware/auth';
import { GoogleOAuthService, hasSufficientDriveScope } from '../services/google-oauth-service';
import { createErrorHandledRouter, createProtectedRouter } from './_shared/router-factory';

const authGoogle = createProtectedRouter();

/**
 * Unprotected router for OAuth callback.
 * The callback is a browser redirect from Google — it cannot carry
 * an Authorization header, so it must be unprotected.
 * Security: the `state` parameter (set during the protected /authorize step)
 * carries the user email, and the authorization code is single-use.
 */
const authGooglePublic = createErrorHandledRouter();

/**
 * GET /auth/google/authorize - Start OAuth flow
 * Redirects to Google OAuth consent screen
 */
authGoogle.get('/authorize', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.get('db'));

  // Use user email as state for verification
  const state = btoa(user.email);
  const authUrl = oauthService.getAuthorizationUrl(state);

  return c.redirect(authUrl);
});

/**
 * GET /auth/google/callback - OAuth callback
 * Exchanges authorization code for tokens
 */
authGooglePublic.get('/callback', async (c) => {
  const oauthService = new GoogleOAuthService(c.env, c.get('db'));

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Handle OAuth errors
  if (error) {
    return c.redirect(`/?google_auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return c.redirect('/?google_auth_error=no_code');
  }

  // State is required — it carries the user email from the protected /authorize step
  if (!state) {
    return c.redirect('/?google_auth_error=missing_state');
  }

  const userEmail = atob(state);

  try {
    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(code);

    // Store tokens
    await oauthService.storeTokens(userEmail, tokens);

    // Redirect to success page
    return c.redirect('/?google_auth_success=true');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return c.redirect('/?google_auth_error=token_exchange_failed');
  }
});

/**
 * POST /auth/google/store-tokens - Store provider tokens from Supabase OAuth
 */
authGoogle.post('/store-tokens', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.get('db'));

  const body = await c.req.json<{
    accessToken?: string;
    refreshToken?: string | null;
  }>();

  if (!body.accessToken) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'accessToken is required' }, 400);
  }

  // Verify token scope via Google tokeninfo
  let scope = '';
  let expiresIn = 3600;
  try {
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${body.accessToken}`
    );
    if (tokenInfoResponse.ok) {
      const tokenInfo = (await tokenInfoResponse.json()) as {
        scope?: string;
        expires_in?: number;
      };
      scope = tokenInfo.scope ?? '';
      expiresIn = tokenInfo.expires_in ?? 3600;
    }
  } catch (error) {
    // If tokeninfo fails, proceed without scope verification but log the error
    console.error('Failed to verify token with Google tokeninfo:', error);
  }

  // If refreshToken is null, preserve existing one
  let refreshToken = body.refreshToken ?? '';
  if (!body.refreshToken) {
    const existingTokens = await oauthService.getStoredTokens(user.email);
    if (existingTokens) {
      refreshToken = existingTokens.refreshToken;
    }
  }

  // Reject if no refresh token available (neither provided nor existing)
  if (!refreshToken) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'No refresh token available. Please re-authenticate with full consent.',
      },
      400
    );
  }

  await oauthService.storeTokens(user.email, {
    accessToken: body.accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn,
    scope,
  });

  return c.json({ success: true });
});

/**
 * GET /auth/google/status - Check connection status
 */
authGoogle.get('/status', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.get('db'));
  const isConfigured = !!(
    c.env.GOOGLE_CLIENT_ID &&
    c.env.GOOGLE_CLIENT_SECRET &&
    c.env.GDRIVE_ROOT_FOLDER_ID
  );

  const tokens = await oauthService.getStoredTokens(user.email);

  c.header('X-Google-Drive-Configured', isConfigured ? 'true' : 'false');

  if (!tokens) {
    return c.json({ connected: false, needsReauth: false });
  }

  // Check if stored token has sufficient scope (full drive, not just drive.file)
  const needsReauth = !hasSufficientDriveScope(tokens.scope);

  return c.json({
    connected: true,
    connectedAt: tokens.createdAt,
    scope: tokens.scope,
    needsReauth,
  });
});

/**
 * POST /auth/google/disconnect - Disconnect Google account
 */
authGoogle.post('/disconnect', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.get('db'));

  await oauthService.disconnect(user.email);

  return c.json({ success: true });
});

export { authGoogle, authGooglePublic };
