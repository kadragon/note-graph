// Trace: SPEC-search-ui-1, TASK-068

import { describe, expect, it } from 'vitest';

import { normalizeSearchQuery, shouldRunUnifiedSearch } from './search-query';

describe('search query helpers', () => {
  describe('normalizeSearchQuery', () => {
    it('should return null for null/empty/blank input', () => {
      expect(normalizeSearchQuery(null)).toBeNull();
      expect(normalizeSearchQuery('')).toBeNull();
      expect(normalizeSearchQuery('   ')).toBeNull();
    });

    it('should trim whitespace and return normalized query', () => {
      expect(normalizeSearchQuery(' 수 ')).toBe('수');
    });
  });

  describe('shouldRunUnifiedSearch', () => {
    it('should not run when nextQuery is null', () => {
      expect(shouldRunUnifiedSearch(null, null)).toBe(false);
      expect(shouldRunUnifiedSearch('수', null)).toBe(false);
    });

    it('should run when query changes', () => {
      expect(shouldRunUnifiedSearch(null, '수')).toBe(true);
      expect(shouldRunUnifiedSearch('수', '수업')).toBe(true);
    });

    it('should not run when query is unchanged', () => {
      expect(shouldRunUnifiedSearch('수', '수')).toBe(false);
    });
  });
});
