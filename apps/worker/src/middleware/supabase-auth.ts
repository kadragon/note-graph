import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface SupabaseJwtPayload {
  sub: string;
  email: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedUrl: string | null = null;

function getJWKS(supabaseUrl: string) {
  if (!jwks || cachedUrl !== supabaseUrl) {
    const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl);
    jwks = createRemoteJWKSet(jwksUrl);
    cachedUrl = supabaseUrl;
  }
  return jwks;
}

/**
 * Verify a Supabase JWT using JWKS and extract user claims.
 *
 * @returns Parsed claims or null if verification fails
 */
export async function verifySupabaseJwt(
  token: string,
  supabaseUrl: string
): Promise<SupabaseJwtPayload | null> {
  try {
    const keySet = getJWKS(supabaseUrl);
    const { payload } = await jwtVerify(token, keySet);

    const email = payload.email as string | undefined;
    const sub = payload.sub as string | undefined;

    if (!email || !sub) {
      return null;
    }

    return { sub, email };
  } catch {
    return null;
  }
}
