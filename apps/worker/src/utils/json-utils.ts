/**
 * Safely parse a JSON-encoded string array with comma-separated fallback.
 * Returns only string elements; non-string values are filtered out.
 */
export function parseKeywordsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
