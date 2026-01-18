import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { marked, type Token, type Tokens } from 'marked';

// Color palette (shared with main document)
const colors = {
  primary: '#3b82f6',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
};

const styles = StyleSheet.create({
  // Block elements
  paragraph: {
    marginBottom: 8,
    lineHeight: 1.7,
    color: colors.gray700,
    fontSize: 10,
  },
  heading1: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.gray800,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingBottom: 4,
  },
  heading2: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.gray800,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.gray800,
    marginTop: 12,
    marginBottom: 4,
  },
  heading4: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.gray700,
    marginTop: 10,
    marginBottom: 4,
  },
  // List styles
  list: {
    marginBottom: 8,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  listBullet: {
    width: 16,
    fontSize: 10,
    color: colors.primary,
  },
  listNumber: {
    width: 20,
    fontSize: 10,
    color: colors.primary,
    fontWeight: 700,
  },
  listContent: {
    flex: 1,
    fontSize: 10,
    color: colors.gray700,
    lineHeight: 1.6,
  },
  // Code styles
  codeBlock: {
    backgroundColor: colors.gray100,
    borderRadius: 4,
    padding: 10,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  codeText: {
    fontSize: 9,
    color: colors.gray700,
    lineHeight: 1.5,
  },
  inlineCode: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 9,
    color: colors.gray700,
  },
  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gray200,
    paddingLeft: 12,
    marginVertical: 8,
    marginLeft: 4,
  },
  blockquoteText: {
    fontSize: 10,
    color: colors.gray500,
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  // Horizontal rule
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginVertical: 12,
  },
  // Inline styles
  bold: {
    fontWeight: 700,
  },
  italic: {
    fontStyle: 'italic',
  },
  strikethrough: {
    textDecoration: 'line-through',
    color: colors.gray500,
  },
});

const headingStyles = [
  styles.heading1,
  styles.heading2,
  styles.heading3,
  styles.heading4,
  styles.heading4, // h5+
  styles.heading4, // h6
];

/**
 * Generate a stable key for a token based on its type and position
 */
function getTokenKey(token: Token, index: number): string {
  const text = 'text' in token ? String(token.text).slice(0, 20) : '';
  return `${token.type}-${index}-${text}`;
}

/**
 * Render inline tokens (bold, italic, code, links, etc.)
 */
function renderInlineTokens(tokens: Token[] | undefined): React.ReactNode[] {
  if (!tokens) return [];

  return tokens.map((token, index) => {
    const key = getTokenKey(token, index);
    switch (token.type) {
      case 'text':
        return <Text key={key}>{token.text}</Text>;

      case 'strong':
        return (
          <Text key={key} style={styles.bold}>
            {renderInlineTokens((token as Tokens.Strong).tokens)}
          </Text>
        );

      case 'em':
        return (
          <Text key={key} style={styles.italic}>
            {renderInlineTokens((token as Tokens.Em).tokens)}
          </Text>
        );

      case 'del':
        return (
          <Text key={key} style={styles.strikethrough}>
            {renderInlineTokens((token as Tokens.Del).tokens)}
          </Text>
        );

      case 'codespan':
        return (
          <Text key={key} style={styles.inlineCode}>
            {(token as Tokens.Codespan).text}
          </Text>
        );

      case 'link':
        // Links shown as text with URL in parentheses
        return (
          <Text key={key} style={styles.bold}>
            {renderInlineTokens((token as Tokens.Link).tokens)}
            <Text style={{ color: colors.gray500, fontWeight: 400 }}>
              {' '}
              ({(token as Tokens.Link).href})
            </Text>
          </Text>
        );

      case 'br':
        return <Text key={key}>{'\n'}</Text>;

      default:
        // Fallback: render raw text if available
        if ('text' in token) {
          return <Text key={key}>{(token as { text: string }).text}</Text>;
        }
        return null;
    }
  });
}

/**
 * Render a single block token
 */
function renderBlockToken(token: Token, index: number): React.ReactNode {
  switch (token.type) {
    case 'heading': {
      const headingToken = token as Tokens.Heading;
      const style = headingStyles[Math.min(headingToken.depth - 1, 5)];
      return (
        <Text key={index} style={style}>
          {renderInlineTokens(headingToken.tokens)}
        </Text>
      );
    }

    case 'paragraph': {
      const paragraphToken = token as Tokens.Paragraph;
      return (
        <Text key={index} style={styles.paragraph}>
          {renderInlineTokens(paragraphToken.tokens)}
        </Text>
      );
    }

    case 'list': {
      const listToken = token as Tokens.List;
      return (
        <View key={index} style={styles.list}>
          {listToken.items.map((item, itemIndex) => {
            const itemKey = `list-item-${itemIndex}-${item.raw?.slice(0, 20) || ''}`;
            return (
              <View key={itemKey} style={styles.listItem}>
                <Text style={listToken.ordered ? styles.listNumber : styles.listBullet}>
                  {listToken.ordered ? `${itemIndex + 1}.` : '\u2022'}
                </Text>
                <Text style={styles.listContent}>{renderInlineTokens(item.tokens)}</Text>
              </View>
            );
          })}
        </View>
      );
    }

    case 'code': {
      const codeToken = token as Tokens.Code;
      return (
        <View key={index} style={styles.codeBlock}>
          <Text style={styles.codeText}>{codeToken.text}</Text>
        </View>
      );
    }

    case 'blockquote': {
      const blockquoteToken = token as Tokens.Blockquote;
      return (
        <View key={index} style={styles.blockquote}>
          <Text style={styles.blockquoteText}>
            {blockquoteToken.tokens?.map((t) => {
              if (t.type === 'paragraph') {
                return renderInlineTokens((t as Tokens.Paragraph).tokens);
              }
              return null;
            })}
          </Text>
        </View>
      );
    }

    case 'hr':
      return <View key={index} style={styles.hr} />;

    case 'space':
      return null;

    default:
      // Fallback: render as plain text
      if ('text' in token) {
        return (
          <Text key={index} style={styles.paragraph}>
            {(token as { text: string }).text}
          </Text>
        );
      }
      return null;
  }
}

interface MarkdownRendererProps {
  content: string;
}

/**
 * Render markdown content as react-pdf components
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const tokens = marked.lexer(content);

  return <View>{tokens.map((token, index) => renderBlockToken(token, index))}</View>;
}
