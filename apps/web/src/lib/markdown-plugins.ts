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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rehypePlugins: any[] = [rehypeHighlight, [rehypeSanitize, sanitizeSchema]];
