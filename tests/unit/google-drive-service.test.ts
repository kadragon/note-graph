import type { D1Database } from '@cloudflare/workers-types';
import { GoogleDriveService } from '@worker/services/google-drive-service';
import type { Env } from '@worker/types/env';
import { describe, expect, it } from 'vitest';

class MockD1Database {
  queries: string[] = [];

  prepare(query: string) {
    this.queries.push(query);

    return {
      bind: () => ({
        first: async <T>() => null as T | null,
        run: async () => ({ success: true }),
      }),
    };
  }
}

class TestGoogleDriveService extends GoogleDriveService {
  async createFolder(_userEmail: string, name: string) {
    return {
      id: 'FOLDER-1',
      name,
      webViewLink: 'https://drive.example/folder',
    };
  }
}

describe('GoogleDriveService', () => {
  it('uses INSERT OR IGNORE when persisting work note folders', async () => {
    const db = new MockD1Database();
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
    } as Env;

    const service = new TestGoogleDriveService(env, db as unknown as D1Database);

    await service.getOrCreateWorkNoteFolder('tester@example.com', 'WORK-123');

    expect(
      db.queries.some((query) => query.includes('INSERT OR IGNORE INTO work_note_gdrive_folders'))
    ).toBe(true);
  });
});
