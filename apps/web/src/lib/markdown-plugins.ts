import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className', /^hljs$/, /^language-/]],
    span: [...(defaultSchema.attributes?.span || []), ['className', /^hljs-/, /^\w+_+$/]],
  },
};

export const remarkPlugins = [remarkGfm];
// biome-ignore lint/suspicious/noExplicitAny: rehype plugin tuple types are not expressible without any
export const rehypePlugins: any[] = [rehypeHighlight, [rehypeSanitize, sanitizeSchema]];
