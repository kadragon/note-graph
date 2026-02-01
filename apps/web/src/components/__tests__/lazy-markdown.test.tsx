import { render, screen } from '@web/test/setup';
import { describe, expect, it } from 'vitest';

import { LazyMarkdown } from '../lazy-markdown';

describe('LazyMarkdown', () => {
  describe('basic rendering', () => {
    it('renders plain text content', () => {
      render(<LazyMarkdown>Hello World</LazyMarkdown>);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders empty string without error', () => {
      const { container } = render(<LazyMarkdown>{''}</LazyMarkdown>);

      expect(container).toBeInTheDocument();
    });
  });

  describe('markdown elements', () => {
    it('renders headings correctly', () => {
      render(<LazyMarkdown># Heading 1</LazyMarkdown>);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Heading 1');
    });

    it('renders multiple heading levels', () => {
      render(
        <LazyMarkdown>
          {`# H1
## H2
### H3`}
        </LazyMarkdown>
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('H1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('H2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('H3');
    });

    it('renders paragraphs', () => {
      render(<LazyMarkdown>This is a paragraph.</LazyMarkdown>);

      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
    });

    it('renders bold text', () => {
      render(<LazyMarkdown>This is **bold** text.</LazyMarkdown>);

      const strong = screen.getByText('bold');
      expect(strong.tagName).toBe('STRONG');
    });

    it('renders italic text', () => {
      render(<LazyMarkdown>This is *italic* text.</LazyMarkdown>);

      const em = screen.getByText('italic');
      expect(em.tagName).toBe('EM');
    });

    it('renders unordered lists', () => {
      render(
        <LazyMarkdown>
          {`- Item 1
- Item 2
- Item 3`}
        </LazyMarkdown>
      );

      const list = screen.getByRole('list');
      expect(list.tagName).toBe('UL');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('renders ordered lists', () => {
      render(
        <LazyMarkdown>
          {`1. First
2. Second
3. Third`}
        </LazyMarkdown>
      );

      const list = screen.getByRole('list');
      expect(list.tagName).toBe('OL');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('renders links', () => {
      render(<LazyMarkdown>[Click here](https://example.com)</LazyMarkdown>);

      const link = screen.getByRole('link', { name: 'Click here' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders inline code', () => {
      render(<LazyMarkdown>Use the `console.log` function.</LazyMarkdown>);

      const code = screen.getByText('console.log');
      expect(code.tagName).toBe('CODE');
    });

    it('renders code blocks', () => {
      const codeContent = `\`\`\`javascript
const x = 1;
\`\`\``;
      render(<LazyMarkdown>{codeContent}</LazyMarkdown>);

      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
      const code = document.querySelector('pre code');
      expect(code).toBeInTheDocument();
    });

    it('renders blockquotes', () => {
      render(<LazyMarkdown>{'> This is a quote'}</LazyMarkdown>);

      const blockquote = document.querySelector('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(blockquote).toHaveTextContent('This is a quote');
    });

    it('renders horizontal rules', () => {
      render(<LazyMarkdown>---</LazyMarkdown>);

      const hr = document.querySelector('hr');
      expect(hr).toBeInTheDocument();
    });
  });

  describe('GitHub Flavored Markdown (GFM)', () => {
    it('renders strikethrough text', () => {
      render(<LazyMarkdown>This is ~~deleted~~ text.</LazyMarkdown>);

      const del = document.querySelector('del');
      expect(del).toBeInTheDocument();
      expect(del).toHaveTextContent('deleted');
    });

    it('renders tables', () => {
      const tableMarkdown = `| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |`;

      render(<LazyMarkdown>{tableMarkdown}</LazyMarkdown>);

      const table = document.querySelector('table');
      expect(table).toBeInTheDocument();
      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
    });

    it('renders task lists', () => {
      const taskList = `- [ ] Unchecked
- [x] Checked`;

      render(<LazyMarkdown>{taskList}</LazyMarkdown>);

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
    });

    it('renders autolinked URLs', () => {
      render(<LazyMarkdown>Visit https://example.com for more info.</LazyMarkdown>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('sanitization', () => {
    it('sanitizes script tags', () => {
      render(<LazyMarkdown>{'<script>alert("xss")</script>'}</LazyMarkdown>);

      const script = document.querySelector('script');
      expect(script).not.toBeInTheDocument();
    });

    it('sanitizes onclick attributes', () => {
      render(<LazyMarkdown>{'<button onclick="alert(1)">Click</button>'}</LazyMarkdown>);

      const button = document.querySelector('button');
      expect(button).not.toBeInTheDocument();
    });

    it('sanitizes javascript URLs', () => {
      render(<LazyMarkdown>{'[Click](javascript:alert(1))'}</LazyMarkdown>);

      const link = screen.queryByRole('link');
      if (link) {
        expect(link.getAttribute('href')).not.toContain('javascript:');
      }
    });
  });

  describe('complex content', () => {
    it('renders mixed markdown content', () => {
      const complexMarkdown = `# Title

This is a **bold** paragraph with *italic* and \`code\`.

## List Section

- Item 1
- Item 2

> A blockquote

[Link](https://example.com)`;

      render(<LazyMarkdown>{complexMarkdown}</LazyMarkdown>);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('List Section');
      expect(screen.getByText('bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('code').tagName).toBe('CODE');
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(document.querySelector('blockquote')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
    });

    it('handles multiline content correctly', () => {
      const multilineContent = `First paragraph.

Second paragraph.

Third paragraph.`;

      render(<LazyMarkdown>{multilineContent}</LazyMarkdown>);

      expect(screen.getByText('First paragraph.')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
      expect(screen.getByText('Third paragraph.')).toBeInTheDocument();
    });
  });
});
