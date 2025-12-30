// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-001
// TEST-testing-migration-001: Jest 설정 파일이 Miniflare 통합을 포함함

describe('Jest + Miniflare Setup Verification', () => {
  it('should have Miniflare instance available', async () => {
    const getMiniflare = globalThis.getMiniflare;
    expect(getMiniflare).toBeDefined();

    const miniflare = getMiniflare();
    expect(miniflare).toBeDefined();
  });

  it('should have D1 database with migrations applied', async () => {
    const getDB = globalThis.getDB;
    expect(getDB).toBeDefined();

    const db = await getDB();
    expect(db).toBeDefined();

    // Verify that migrations have been applied by checking a table exists
    const result = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='persons'")
      .first();

    expect(result).toBeDefined();
    expect(result?.name).toBe('persons');
  });

  it('should be able to query D1 database', async () => {
    const getDB = globalThis.getDB;
    const db = await getDB();

    // Simple query to verify database is functional
    const result = await db.prepare('SELECT COUNT(*) as count FROM persons').first();

    expect(result).toBeDefined();
    expect(typeof result?.count).toBe('number');
  });
});
