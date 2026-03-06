import { parseKeywordsJson } from '@worker/utils/json-utils';
import { describe, expect, it } from 'vitest';

describe('parseKeywordsJson', () => {
  it('returns empty array for null', () => {
    expect(parseKeywordsJson(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseKeywordsJson(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseKeywordsJson('')).toEqual([]);
  });

  it('parses valid JSON string array', () => {
    expect(parseKeywordsJson('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for valid JSON that is not an array', () => {
    expect(parseKeywordsJson('{"key":"val"}')).toEqual([]);
  });

  it('filters out non-string elements from JSON array', () => {
    expect(parseKeywordsJson('[1, "a", null, true, "b"]')).toEqual(['a', 'b']);
  });

  it('falls back to comma-split for invalid JSON', () => {
    expect(parseKeywordsJson('foo, bar, baz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('filters empty segments in comma-split fallback', () => {
    expect(parseKeywordsJson('foo,,bar')).toEqual(['foo', 'bar']);
  });

  it('handles truncated JSON via comma-split fallback', () => {
    const result = parseKeywordsJson('["keyword1","keyw');
    expect(result.length).toBeGreaterThan(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for JSON number', () => {
    expect(parseKeywordsJson('42')).toEqual([]);
  });

  it('returns empty array for JSON string (not array)', () => {
    expect(parseKeywordsJson('"hello"')).toEqual([]);
  });
});
