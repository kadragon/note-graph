import type { D1Database } from '@cloudflare/workers-types';
import { GoogleDriveService } from '@worker/services/google-drive-service';
import type { Env } from '@worker/types/env';
import { describe, expect, it } from 'vitest';

class MockD1Database {
  queries: string[] = [];
  private bindings: unknown[] = [];

  constructor(
    private workNoteCreatedAt: string | null = null,
    private existingFolder = false
  ) {}

  prepare(query: string) {
    this.queries.push(query);
    this.bindings = [];

    return {
      bind: (...params: unknown[]) => {
        this.bindings = params;
        return {
          first: async <T>() => {
            if (query.includes('FROM work_notes')) {
              return this.workNoteCreatedAt
                ? ({ createdAt: this.workNoteCreatedAt } as T)
                : (null as T | null);
            }
            if (query.includes('FROM work_note_gdrive_folders')) {
              const workId = this.bindings[0];
              return this.existingFolder && this.workNoteCreatedAt && workId
                ? ({
                    gdriveFolderId: 'FOLDER-EXISTING',
                    gdriveFolderLink: 'https://drive.example/WORK-123',
                  } as T)
                : (null as T | null);
            }
            return null as T | null;
          },
          run: async () => ({ success: true }),
        };
      },
    };
  }
}

class TestGoogleDriveService extends GoogleDriveService {
  createFolderCalls: Array<{ name: string; parentId?: string }> = [];
  ensureFolderCalls: Array<{ folderId: string; parentId: string }> = [];
  metadataCalls: string[] = [];

  async findFolderByNameInParent() {
    return null;
  }

  async createFolder(_userEmail: string, name: string, parentId?: string) {
    this.createFolderCalls.push({ name, parentId });
    return {
      id: `FOLDER-${this.createFolderCalls.length}`,
      name,
      webViewLink: `https://drive.example/${name}`,
    };
  }

  async getFileMetadata(_userEmail: string, fileId: string) {
    this.metadataCalls.push(fileId);
    return {
      id: fileId,
      name: 'WORK-123',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: 'https://drive.example/folder',
      size: '0',
      parents: ['FOLDER-OLD'],
    };
  }

  protected async ensureFolderInParent(
    _userEmail: string,
    folderId: string,
    parentId: string
  ): Promise<void> {
    this.ensureFolderCalls.push({ folderId, parentId });
  }
}

describe('GoogleDriveService', () => {
  it('uses INSERT OR IGNORE when persisting work note folders', async () => {
    const db = new MockD1Database('2023-01-01T00:00:00.000Z');
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;

    const service = new TestGoogleDriveService(env, db as unknown as D1Database);

    await service.getOrCreateWorkNoteFolder('tester@example.com', 'WORK-123');

    expect(
      db.queries.some((query) => query.includes('INSERT OR IGNORE INTO work_note_gdrive_folders'))
    ).toBe(true);
  });

  it('ensures existing work note folders live under the year folder', async () => {
    const db = new MockD1Database('2023-05-10T00:00:00.000Z', true);
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;

    const service = new TestGoogleDriveService(env, db as unknown as D1Database);

    await service.getOrCreateWorkNoteFolder('tester@example.com', 'WORK-123');

    expect(service.ensureFolderCalls).toEqual([
      { folderId: 'FOLDER-EXISTING', parentId: 'FOLDER-1' },
    ]);
  });

  it('creates a year folder under the Drive root for new work notes', async () => {
    const db = new MockD1Database('2023-05-10T00:00:00.000Z');
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;

    const service = new TestGoogleDriveService(env, db as unknown as D1Database);

    await service.getOrCreateWorkNoteFolder('tester@example.com', 'WORK-123');

    expect(service.createFolderCalls).toEqual([
      { name: '2023', parentId: 'test-gdrive-root-folder-id' },
      { name: 'WORK-123', parentId: 'FOLDER-1' },
    ]);
  });
});
