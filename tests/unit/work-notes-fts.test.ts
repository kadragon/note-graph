import {
  buildWorkNoteTsQuery,
  extractWorkNoteFtsTokens,
  normalizeWorkNoteSearchPhrase,
} from '@worker/utils/work-notes-fts';
import { describe, expect, it } from 'vitest';

describe('work-notes-fts utils', () => {
  it('extracts unique alphanumeric tokens from mixed query', () => {
    const tokens = extractWorkNoteFtsTokens('  "검색!!"  (성능) 검색   test@@  ');

    expect(tokens).toEqual(['검색', '성능', 'test']);
  });

  it('normalizes spacing for phrase matching', () => {
    const phrase = normalizeWorkNoteSearchPhrase('  검색    성능   개선  ');

    expect(phrase).toBe('검색 성능 개선');
  });

  it('builds tsquery AND syntax for PostgreSQL', () => {
    const query = buildWorkNoteTsQuery('검색 성능', 'AND');

    expect(query).toBe("'검색' & '성능'");
  });

  it('builds tsquery OR syntax for PostgreSQL', () => {
    const query = buildWorkNoteTsQuery('검색 성능', 'OR');

    expect(query).toBe("'검색' | '성능'");
  });

  it('returns empty tsquery for punctuation-only input', () => {
    const query = buildWorkNoteTsQuery(' !!! ((( ))) ::: ', 'AND');

    expect(query).toBe('');
  });
});
