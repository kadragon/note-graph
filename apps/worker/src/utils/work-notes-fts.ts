const FTS_TERM_PATTERN = /[\p{L}\p{N}]+/gu;

function quoteFtsToken(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

export function extractWorkNoteFtsTokens(rawQuery: string): string[] {
  return [...new Set(rawQuery.match(FTS_TERM_PATTERN) ?? [])];
}

export function normalizeWorkNoteSearchPhrase(rawQuery: string): string {
  return rawQuery.trim().replace(/\s+/g, ' ');
}

export function buildWorkNoteFtsQuery(rawQuery: string, operator: 'AND' | 'OR'): string {
  const tokens = extractWorkNoteFtsTokens(rawQuery);
  if (tokens.length === 0) {
    return '';
  }

  return tokens.map((token) => quoteFtsToken(token)).join(` ${operator} `);
}

export function buildWorkNoteTsQuery(rawQuery: string, operator: 'AND' | 'OR'): string {
  const tokens = extractWorkNoteFtsTokens(rawQuery);
  if (tokens.length === 0) {
    return '';
  }

  const pgOperator = operator === 'AND' ? ' & ' : ' | ';
  return tokens.map((token) => `'${token.replace(/'/g, "''")}'`).join(pgOperator);
}
