import type { D1Database, R2Bucket, R2ObjectBody } from '@cloudflare/workers-types';
import type { Env } from '../apps/worker/src/types/env.js';

type Logger = Pick<Console, 'info' | 'warn' | 'error'>;

interface DriveFolderRecord {
  workId: string;
  gdriveFolderId: string;
  gdriveFolderLink: string;
  createdAt: string;
}

interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string;
}

export interface DriveClient {
  getOrCreateWorkNoteFolder(userEmail: string, workId: string): Promise<DriveFolderRecord>;
  uploadFile(
    userEmail: string,
    folderId: string,
    file: Blob,
    fileName: string,
    mimeType: string
  ): Promise<DriveFileRecord>;
}

interface MigrationOptions {
  db: D1Database;
  r2: R2Bucket;
  drive: DriveClient;
  userEmail: string;
  deleteR2?: boolean;
  logger?: Logger;
}

interface WorkNoteFileRow {
  file_id: string;
  work_id: string;
  r2_key: string | null;
  original_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
}

interface GDriveFolderRow {
  gdrive_folder_id: string;
  gdrive_folder_link: string;
}

const DEFAULT_LOGGER: Logger = console;

interface CliBindings {
  env: Env;
  db: D1Database;
  r2: R2Bucket;
  dispose?: () => Promise<void>;
}

interface CliDeps {
  createBindings?: () => Promise<CliBindings>;
  driveFactory?: (env: Env, db: D1Database) => DriveClient | Promise<DriveClient>;
  migrate?: (options: MigrationOptions) => Promise<number>;
  logger?: Logger;
}

interface CliArgs {
  userEmail: string | null;
  deleteR2: boolean;
}

export async function migrateR2WorkNoteFiles(options: MigrationOptions): Promise<number> {
  const { db, r2, drive, userEmail, deleteR2 = false, logger = DEFAULT_LOGGER } = options;

  const filesResult = await db
    .prepare(
      `SELECT file_id, work_id, r2_key, original_name, file_type, file_size, uploaded_by
       FROM work_note_files
       WHERE storage_type = 'R2' AND deleted_at IS NULL`
    )
    .all<WorkNoteFileRow>();

  const files = filesResult.results ?? [];
  if (files.length === 0) {
    logger.info('No R2 files to migrate.');
    return 0;
  }

  const grouped = new Map<string, WorkNoteFileRow[]>();
  for (const file of files) {
    const group = grouped.get(file.work_id);
    if (group) {
      group.push(file);
    } else {
      grouped.set(file.work_id, [file]);
    }
  }

  let migratedCount = 0;

  for (const [workId, group] of grouped) {
    const folder = await ensureWorkNoteFolder({ db, drive, userEmail, workId });

    for (const file of group) {
      if (!file.r2_key) {
        logger.warn(`Skipping file ${file.file_id}: missing r2_key.`);
        continue;
      }

      const object = await r2.get(file.r2_key);
      if (!object) {
        logger.warn(`Skipping file ${file.file_id}: R2 object not found.`);
        continue;
      }

      const blob = await r2ObjectToBlob(object, file.file_type);
      const uploaded = await drive.uploadFile(
        userEmail,
        folder.gdriveFolderId,
        blob,
        file.original_name,
        file.file_type
      );

      await db
        .prepare(
          `UPDATE work_note_files
           SET storage_type = 'GDRIVE',
               gdrive_file_id = ?,
               gdrive_folder_id = ?,
               gdrive_web_view_link = ?
           WHERE file_id = ?`
        )
        .bind(uploaded.id, folder.gdriveFolderId, uploaded.webViewLink, file.file_id)
        .run();

      if (deleteR2) {
        await r2.delete(file.r2_key);
      }

      migratedCount += 1;
    }
  }

  return migratedCount;
}

export async function runMigrationCli(
  argv: string[] = defaultArgv(),
  deps: CliDeps = {}
): Promise<number> {
  const logger = deps.logger ?? DEFAULT_LOGGER;
  const args = parseCliArgs(argv);

  if (!args.userEmail) {
    logger.error('Missing required flag: --user-email');
    logger.info('Usage: bun run scripts/migrate-r2-to-gdrive.ts --user-email you@example.com');
    return 1;
  }

  const createBindings = deps.createBindings ?? createDefaultBindings;
  const driveFactory = deps.driveFactory ?? defaultDriveFactory;
  const migrate = deps.migrate ?? migrateR2WorkNoteFiles;
  let bindings: CliBindings | null = null;

  try {
    bindings = await createBindings();
    const drive = await driveFactory(bindings.env, bindings.db);
    const migrated = await migrate({
      db: bindings.db,
      r2: bindings.r2,
      drive,
      userEmail: args.userEmail,
      deleteR2: args.deleteR2,
      logger,
    });

    logger.info(`Migrated ${migrated} file${migrated === 1 ? '' : 's'}.`);
    return 0;
  } catch (error) {
    logger.error(error);
    return 1;
  } finally {
    await bindings?.dispose?.();
  }
}

function parseCliArgs(argv: string[]): CliArgs {
  let userEmail: string | null = null;
  let deleteR2 = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--delete-r2') {
      deleteR2 = true;
      continue;
    }

    if (arg === '--user-email') {
      userEmail = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg.startsWith('--user-email=')) {
      userEmail = arg.split('=').slice(1).join('=') || null;
    }
  }

  return { userEmail, deleteR2 };
}

function defaultArgv(): string[] {
  if (typeof process === 'undefined') {
    return [];
  }

  return process.argv.slice(2);
}

async function createDefaultBindings(): Promise<CliBindings> {
  const { Miniflare } = await import('miniflare');
  const bindings = buildEnvBindings();
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: '2025-01-01',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'worknote-db' },
    r2Buckets: { R2_BUCKET: 'worknote-files' },
    bindings,
    d1Persist: process.env.D1_PERSIST,
    r2Persist: process.env.R2_PERSIST,
  });

  const db = await mf.getD1Database('DB');
  const r2 = await mf.getR2Bucket('R2_BUCKET');
  const env = {
    ...bindings,
    DB: db,
    R2_BUCKET: r2,
  } as Env;

  return {
    env,
    db,
    r2,
    dispose: () => mf.dispose(),
  };
}

async function defaultDriveFactory(env: Env, db: D1Database): Promise<DriveClient> {
  const { GoogleDriveService } = await import(
    '../apps/worker/src/services/google-drive-service.js'
  );
  return new GoogleDriveService(env, db);
}

function buildEnvBindings(): Record<string, string> {
  return {
    ENVIRONMENT: process.env.ENVIRONMENT ?? 'development',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    AI_GATEWAY_ID: process.env.AI_GATEWAY_ID ?? 'worknote-maker',
    OPENAI_MODEL_CHAT: process.env.OPENAI_MODEL_CHAT ?? 'gpt-5.1',
    OPENAI_MODEL_EMBEDDING: process.env.OPENAI_MODEL_EMBEDDING ?? 'text-embedding-3-small',
    OPENAI_MODEL_LIGHTWEIGHT: process.env.OPENAI_MODEL_LIGHTWEIGHT ?? 'gpt-5-mini',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? '',
    GDRIVE_ROOT_FOLDER_ID: process.env.GDRIVE_ROOT_FOLDER_ID ?? '',
  };
}

async function ensureWorkNoteFolder(params: {
  db: D1Database;
  drive: DriveClient;
  userEmail: string;
  workId: string;
}): Promise<DriveFolderRecord> {
  const { db, drive, userEmail, workId } = params;

  const existing = await db
    .prepare(
      `SELECT gdrive_folder_id, gdrive_folder_link
       FROM work_note_gdrive_folders
       WHERE work_id = ?`
    )
    .bind(workId)
    .first<GDriveFolderRow>();

  if (existing) {
    return {
      workId,
      gdriveFolderId: existing.gdrive_folder_id,
      gdriveFolderLink: existing.gdrive_folder_link,
      createdAt: new Date().toISOString(),
    };
  }

  const folder = await drive.getOrCreateWorkNoteFolder(userEmail, workId);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT OR IGNORE INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(workId, folder.gdriveFolderId, folder.gdriveFolderLink, now)
    .run();

  return {
    ...folder,
    createdAt: folder.createdAt ?? now,
  };
}

async function r2ObjectToBlob(object: R2ObjectBody, fallbackType: string): Promise<Blob> {
  const buffer = await new Response(object.body).arrayBuffer();
  const contentType =
    object.httpMetadata?.contentType || fallbackType || 'application/octet-stream';
  return new Blob([buffer], { type: contentType });
}

if (import.meta.main) {
  runMigrationCli()
    .then((code) => {
      if (typeof process !== 'undefined') {
        process.exit(code);
      }
    })
    .catch((error) => {
      console.error(error);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    });
}
