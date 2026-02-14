/**
 * Google OAuth routes for Drive integration
 */

import { getAuthUser } from '../middleware/auth';
import { GoogleOAuthService, hasSufficientDriveScope } from '../services/google-oauth-service';
import { createProtectedRouter } from './_shared/router-factory';

const authGoogle = createProtectedRouter();

/**
 * GET /auth/google/authorize - Start OAuth flow
 * Redirects to Google OAuth consent screen
 */
authGoogle.get('/authorize', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);

  // Use user email as state for verification
  const state = btoa(user.email);
  const authUrl = oauthService.getAuthorizationUrl(state);

  return c.redirect(authUrl);
});

/**
 * GET /auth/google/callback - OAuth callback
 * Exchanges authorization code for tokens
 */
authGoogle.get('/callback', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);

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

  // Verify state matches user
  if (state) {
    const decodedState = atob(state);
    if (decodedState !== user.email) {
      return c.redirect('/?google_auth_error=state_mismatch');
    }
  }

  try {
    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(code);

    // Store tokens
    await oauthService.storeTokens(user.email, tokens);

    // Redirect to success page
    return c.redirect('/?google_auth_success=true');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return c.redirect('/?google_auth_error=token_exchange_failed');
  }
});

/**
 * GET /auth/google/status - Check connection status
 */
authGoogle.get('/status', async (c) => {
  const user = getAuthUser(c);
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);
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
  const oauthService = new GoogleOAuthService(c.env, c.env.DB);

  await oauthService.disconnect(user.email);

  return c.json({ success: true });
});

export { authGoogle };
