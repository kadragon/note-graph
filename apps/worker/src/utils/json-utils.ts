/**
 * Safely parse a JSON-encoded string array with comma-separated fallback.
 * Returns only string elements; non-string values are filtered out.
 * Accepts unknown to handle pre-parsed JSONB arrays from PostgreSQL drivers.
 */
export function parseKeywordsJson(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string');
  if (typeof raw !== 'string') {
    console.warn(`parseKeywordsJson: unexpected type ${typeof raw}`);
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
