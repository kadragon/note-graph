import { marked, type Token, type Tokens } from 'marked';
import { describe, expect, it } from 'vitest';

// Test markdown parsing logic (the core of MarkdownRenderer)
// Full PDF rendering is tested via generate-work-note-pdf.test.ts
describe('MarkdownRenderer parsing', () => {
  it('parses plain text as paragraph', () => {
    const tokens = marked.lexer('Hello World');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('paragraph');
  });

  it('parses headings', () => {
    const content = `# Heading 1
## Heading 2
### Heading 3`;
    const tokens = marked.lexer(content);
    const headings = tokens.filter((t) => t.type === 'heading');
    expect(headings).toHaveLength(3);
    expect((headings[0] as Tokens.Heading).depth).toBe(1);
    expect((headings[1] as Tokens.Heading).depth).toBe(2);
    expect((headings[2] as Tokens.Heading).depth).toBe(3);
  });

  it('parses bold and italic text', () => {
    const content = '**bold** and *italic*';
    const tokens = marked.lexer(content);
    expect(tokens).toHaveLength(1);
    const paragraph = tokens[0] as Tokens.Paragraph;
    const inlineTokens = paragraph.tokens || [];
    expect(inlineTokens.some((t: Token) => t.type === 'strong')).toBe(true);
    expect(inlineTokens.some((t: Token) => t.type === 'em')).toBe(true);
  });

  it('parses unordered lists', () => {
    const content = `- Item 1
- Item 2
- Item 3`;
    const tokens = marked.lexer(content);
    const lists = tokens.filter((t) => t.type === 'list');
    expect(lists).toHaveLength(1);
    const list = lists[0] as Tokens.List;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
  });

  it('parses ordered lists', () => {
    const content = `1. First
2. Second
3. Third`;
    const tokens = marked.lexer(content);
    const lists = tokens.filter((t) => t.type === 'list');
    expect(lists).toHaveLength(1);
    const list = lists[0] as Tokens.List;
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(3);
  });

  it('parses code blocks', () => {
    const content = '```\nconst x = 1;\n```';
    const tokens = marked.lexer(content);
    const codes = tokens.filter((t) => t.type === 'code');
    expect(codes).toHaveLength(1);
    expect((codes[0] as Tokens.Code).text).toContain('const x = 1;');
  });

  it('parses blockquotes', () => {
    const content = '> This is a quote';
    const tokens = marked.lexer(content);
    const quotes = tokens.filter((t) => t.type === 'blockquote');
    expect(quotes).toHaveLength(1);
  });

  it('handles Korean text', () => {
    const content = `# 제목

내용입니다.

- 항목 1
- 항목 2`;
    const tokens = marked.lexer(content);
    const headings = tokens.filter((t) => t.type === 'heading');
    const lists = tokens.filter((t) => t.type === 'list');
    expect(headings).toHaveLength(1);
    expect((headings[0] as Tokens.Heading).text).toBe('제목');
    expect(lists).toHaveLength(1);
  });

  it('handles empty content', () => {
    const tokens = marked.lexer('');
    expect(tokens).toHaveLength(0);
  });

  it('parses horizontal rules', () => {
    const content = 'Before\n\n---\n\nAfter';
    const tokens = marked.lexer(content);
    const hrs = tokens.filter((t) => t.type === 'hr');
    expect(hrs).toHaveLength(1);
  });

  it('parses inline code', () => {
    const content = 'Use `const` for constants';
    const tokens = marked.lexer(content);
    const paragraph = tokens[0] as Tokens.Paragraph;
    const inlineTokens = paragraph.tokens || [];
    expect(inlineTokens.some((t: Token) => t.type === 'codespan')).toBe(true);
  });
});
