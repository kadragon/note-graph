// Lazy-loaded markdown component for bundle size optimization
// Trace: plan.md - Bundle Size optimization

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

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
