import { describe, expect, it } from 'vitest';
import { getCharacterCount, truncateToMaxCharacters } from './character-length';

describe('character-length', () => {
  describe('getCharacterCount', () => {
    it('counts mixed Korean, English, and symbol characters', () => {
      expect(getCharacterCount('가A!')).toBe(3);
    });

    it('counts astral characters using UTF-16 code units', () => {
      expect(getCharacterCount('😀')).toBe(2);
    });
  });

  describe('truncateToMaxCharacters', () => {
    it('truncates BMP text at the limit', () => {
      const value = '가A!'.repeat(700);

      expect(truncateToMaxCharacters(value, 2000)).toHaveLength(2000);
    });

    it('keeps astral characters only when fully within the UTF-16 limit', () => {
      const withBoundaryEmoji = `${'a'.repeat(1998)}😀`;
      const overflowEmoji = `${'a'.repeat(1999)}😀`;

      expect(truncateToMaxCharacters(withBoundaryEmoji, 2000)).toBe(withBoundaryEmoji);
      expect(truncateToMaxCharacters(overflowEmoji, 2000)).toBe('a'.repeat(1999));
    });
  });
});
