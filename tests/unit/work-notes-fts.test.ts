import {
  buildWorkNoteFtsQuery,
  extractWorkNoteFtsTokens,
  normalizeWorkNoteSearchPhrase,
} from '@worker/utils/work-notes-fts';
import { describe, expect, it } from 'vitest';

describe('work-notes-fts utils', () => {
  it('extracts unique alphanumeric tokens from mixed query', () => {
    const tokens = extractWorkNoteFtsTokens('  "검색!!"  (성능) 검색   test@@  ');

    expect(tokens).toEqual(['검색', '성능', 'test']);
  });

  it('builds quoted AND query from tokens', () => {
    const query = buildWorkNoteFtsQuery('검색 성능', 'AND');

    expect(query).toBe('"검색" AND "성능"');
  });

  it('builds quoted OR query from tokens', () => {
    const query = buildWorkNoteFtsQuery('검색 성능', 'OR');

    expect(query).toBe('"검색" OR "성능"');
  });

  it('returns empty query for punctuation-only input', () => {
    const query = buildWorkNoteFtsQuery(' !!! ((( ))) ::: ', 'AND');

    expect(query).toBe('');
  });

  it('normalizes spacing for phrase matching', () => {
    const phrase = normalizeWorkNoteSearchPhrase('  검색    성능   개선  ');

    expect(phrase).toBe('검색 성능 개선');
  });
});
