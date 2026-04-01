import { describe, expect, it, vi } from 'vitest';
import type { TransactionClient } from '@/types/database';
import { queryInChunks, SQL_VAR_LIMIT } from '@/utils/db-utils';

describe('queryInChunks', () => {
  function makeMockClient(rows: unknown[] = []): TransactionClient {
    return {
      query: vi.fn().mockResolvedValue({ rows }),
      queryOne: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
    };
  }

  it('returns empty array for empty items', async () => {
    const client = makeMockClient();
    const result = await queryInChunks(client, [], vi.fn());
    expect(result).toEqual([]);
  });

  it('passes items and placeholders to queryFn', async () => {
    const client = makeMockClient();
    const queryFn = vi.fn().mockResolvedValue([{ id: '1' }]);

    await queryInChunks(client, ['a', 'b'], queryFn);

    expect(queryFn).toHaveBeenCalledWith(client, ['a', 'b'], '$1, $2');
  });

  it('works with a TransactionClient (not just DatabaseClient)', async () => {
    const tx = makeMockClient([{ todoId: '1' }]);
    const queryFn = vi.fn().mockResolvedValue([{ todoId: '1' }]);

    const result = await queryInChunks(tx, ['id1'], queryFn);

    expect(result).toEqual([{ todoId: '1' }]);
    expect(queryFn).toHaveBeenCalledWith(tx, ['id1'], '$1');
  });

  it('chunks items exceeding SQL_VAR_LIMIT', async () => {
    const client = makeMockClient();
    const items = Array.from({ length: SQL_VAR_LIMIT + 10 }, (_, i) => `item${i}`);
    const queryFn = vi.fn().mockResolvedValue([]);

    await queryInChunks(client, items, queryFn);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(queryFn.mock.calls[0][1]).toHaveLength(SQL_VAR_LIMIT);
    expect(queryFn.mock.calls[1][1]).toHaveLength(10);
  });

  it('combines results from multiple chunks', async () => {
    const client = makeMockClient();
    const items = Array.from({ length: SQL_VAR_LIMIT + 5 }, (_, i) => `item${i}`);
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'chunk1' }])
      .mockResolvedValueOnce([{ id: 'chunk2' }]);

    const result = await queryInChunks(client, items, queryFn);

    expect(result).toEqual([{ id: 'chunk1' }, { id: 'chunk2' }]);
  });
});
