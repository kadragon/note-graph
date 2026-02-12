const FTS_TERM_PATTERN = /[\p{L}\p{N}]+/gu;

function toFiniteRank(value: number): number {
  if (Number.isFinite(value)) {
    return value;
  }
  return 0;
}

export function buildMeetingMinutesFtsQuery(rawQuery: string): string {
  const tokens = rawQuery.match(FTS_TERM_PATTERN) ?? [];
  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];

  if (uniqueTokens.length === 0) {
    return '';
  }

  return uniqueTokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
}

export function sortMeetingMinutesFtsRowsByRank<T extends { ftsRank: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => toFiniteRank(left.ftsRank) - toFiniteRank(right.ftsRank));
}

export function mapMeetingMinutesFtsScores<T extends { ftsRank: number }>(
  rows: T[]
): Array<T & { score: number }> {
  const sortedRows = sortMeetingMinutesFtsRowsByRank(rows);

  if (sortedRows.length === 0) {
    return [];
  }

  const ranks = sortedRows.map((row) => toFiniteRank(row.ftsRank));
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);

  return sortedRows.map((row) => {
    const rank = toFiniteRank(row.ftsRank);
    const normalizedScore =
      maxRank === minRank ? 1 : Number(((maxRank - rank) / (maxRank - minRank)).toFixed(6));

    return {
      ...row,
      score: normalizedScore,
    };
  });
}
