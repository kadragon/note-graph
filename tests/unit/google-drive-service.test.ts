import type { D1Database } from '@cloudflare/workers-types';
import { GoogleDriveService } from '@worker/services/google-drive-service';
import type { Env } from '@worker/types/env';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

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
  getOrCreateWorkNoteFolder = super.getOrCreateWorkNoteFolder;

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

class DriveServiceHarness extends GoogleDriveService {
  constructor(
    env: Env,
    db: D1Database,
    private metadata: Awaited<ReturnType<GoogleDriveService['getFileMetadata']>>
  ) {
    super(env, db);
  }

  async getFileMetadata() {
    return this.metadata;
  }

  async ensureFolderInParentForTest(userEmail: string, folderId: string, parentId: string) {
    await (
      this as unknown as { ensureFolderInParent: typeof this.ensureFolderInParent }
    ).ensureFolderInParent(userEmail, folderId, parentId);
  }
}

describe('GoogleDriveService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      GoogleDriveService.prototype as unknown as {
        getAccessToken: (userEmail: string) => Promise<string>;
      },
      'getAccessToken'
    ).mockResolvedValue('token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : String(input);

      if (url.includes('/files?fields=files')) {
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }

      return new Response('{}', { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escapes query values when searching for folders', async () => {
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      GDRIVE_ROOT_FOLDER_ID: 'test-gdrive-root-folder-id',
    } as Env;
    const service = new GoogleDriveService(env, {} as D1Database);

    vi.spyOn(
      service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
      'getAccessToken'
    ).mockResolvedValue('token');

    const name = "2023' OR '1'='1";
    const parentId = "parent'id";

    await service.findFolderByNameInParent('tester@example.com', name, parentId);

    const fetchSpy = globalThis.fetch as unknown as Mock;
    const [url] = fetchSpy.mock.calls[0] ?? [];
    const urlValue = typeof url === 'string' ? url : String(url);
    const decodedQuery = decodeURIComponent(new URL(urlValue).searchParams.get('q') ?? '');
    const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedParentId = parentId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    expect(decodedQuery).toContain(`name = '${escapedName}'`);
    expect(decodedQuery).toContain(`'${escapedParentId}' in parents`);
  });

  it('removes the root parent when moving folders into year buckets', async () => {
    const env = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.test/oauth/callback',
      GDRIVE_ROOT_FOLDER_ID: 'root-folder',
    } as Env;
    const metadata = {
      id: 'folder-id',
      name: 'WORK-123',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: 'https://drive.example/folder',
      size: '0',
      parents: ['root-folder'],
    };
    const service = new DriveServiceHarness(env, {} as D1Database, metadata);

    vi.spyOn(
      service as unknown as { getAccessToken: (userEmail: string) => Promise<string> },
      'getAccessToken'
    ).mockResolvedValue('token');

    await service.ensureFolderInParentForTest('tester@example.com', 'folder-id', 'year-folder');

    const fetchSpy = globalThis.fetch as unknown as Mock;
    const [url] = fetchSpy.mock.calls[0] ?? [];
    const urlValue = typeof url === 'string' ? url : String(url);
    const params = new URL(urlValue).searchParams;

    expect(params.get('addParents')).toBe('year-folder');
    expect(params.get('removeParents')).toBe('root-folder');
  });

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
