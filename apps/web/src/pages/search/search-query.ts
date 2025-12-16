// Trace: SPEC-search-ui-1, TASK-068

export function normalizeSearchQuery(query: string | null): string | null {
  const normalized = (query ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function shouldRunUnifiedSearch(
  prevQuery: string | null,
  nextQuery: string | null
): boolean {
  if (!nextQuery) {
    return false;
  }
  return prevQuery !== nextQuery;
}
