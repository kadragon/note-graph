// Trace: SPEC-ui-1, TASK-034
import { describe, expect, it } from 'vitest';
import { preserveLineBreaksForMarkdown } from '../../frontend/src/lib/utils';

describe('preserveLineBreaksForMarkdown', () => {
  it('converts single newlines to markdown line breaks', () => {
    const input = 'first line\nsecond line';
    const output = preserveLineBreaksForMarkdown(input);
    expect(output).toBe('first line  \nsecond line');
  });

  it('normalizes CRLF line endings', () => {
    const input = 'alpha\r\nbeta';
    const output = preserveLineBreaksForMarkdown(input);
    expect(output).toBe('alpha  \nbeta');
  });

  it('preserves consecutive blank lines', () => {
    const input = 'top\n\nbottom';
    const output = preserveLineBreaksForMarkdown(input);
    expect(output).toBe('top  \n  \nbottom');
  });

  it('returns empty string for empty input', () => {
    expect(preserveLineBreaksForMarkdown('')).toBe('');
  });
});
