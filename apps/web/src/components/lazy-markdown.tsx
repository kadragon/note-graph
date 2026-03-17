// Lazy-loaded markdown component for bundle size optimization

import { rehypePlugins, remarkPlugins } from '@web/lib/markdown-plugins';
import ReactMarkdown from 'react-markdown';

interface LazyMarkdownProps {
  children: string;
}

export function LazyMarkdown({ children }: LazyMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {children}
    </ReactMarkdown>
  );
}
