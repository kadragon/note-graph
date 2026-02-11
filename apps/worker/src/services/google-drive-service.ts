/**
 * Google Drive service for file operations
 */

import type { Env } from '../types/env';
import { GoogleOAuthService } from './google-oauth-service';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
  parents?: string[];
}

export interface GDriveFolderRecord {
  workId: string;
  gdriveFolderId: string;
  gdriveFolderLink: string;
  createdAt: string;
}

export class GoogleDriveService {
  private oauthService: GoogleOAuthService;

  constructor(
    private env: Env,
    private db: D1Database
  ) {
    this.oauthService = new GoogleOAuthService(env, db);
  }

  /**
   * Get valid access token for the user
   */
  private async getAccessToken(userEmail: string): Promise<string> {
    return this.oauthService.getValidAccessToken(userEmail);
  }

  /**
   * Escape a value for use as a single-quoted literal in a Drive query string.
   * Backslashes are escaped first, then single quotes.
   */
  private escapeQueryStringLiteral(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(userEmail: string, name: string, parentId?: string): Promise<DriveFolder> {
    const accessToken = await this.getAccessToken(userEmail);

    const metadata: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    } else if (this.env.GDRIVE_ROOT_FOLDER_ID) {
      metadata.parents = [this.env.GDRIVE_ROOT_FOLDER_ID];
    }

    const response = await fetch(`${DRIVE_API_BASE}/files?fields=id,name,webViewLink,parents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create folder: ${error}`);
    }

    const data = (await response.json()) as DriveFolder;
    return data;
  }

  /**
   * Find a folder by name within a parent folder
   */
  async findFolderByNameInParent(
    userEmail: string,
    name: string,
    parentId: string
  ): Promise<DriveFolder | null> {
    const accessToken = await this.getAccessToken(userEmail);
    const escapedName = this.escapeQueryStringLiteral(name);
    const escapedParentId = this.escapeQueryStringLiteral(parentId);
    const query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${escapedParentId}' in parents and trashed = false`;
    const url = `${DRIVE_API_BASE}/files?fields=files(id,name,webViewLink,parents)&q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list folders: ${error}`);
    }

    const data = (await response.json()) as { files?: DriveFolder[] };
    return data.files?.[0] ?? null;
  }

  /**
   * Build a year folder name from ISO timestamp
   */
  private buildYearFolderName(createdAt: string): string {
    return new Date(createdAt).getUTCFullYear().toString();
  }

  /**
   * Ensure a folder exists in the specified parent
   */
  protected async ensureFolderInParent(
    userEmail: string,
    folderId: string,
    parentId: string
  ): Promise<void> {
    const metadata = await this.getFileMetadata(userEmail, folderId);

    if (!metadata) {
      throw new Error(`Google Drive folder not found: ${folderId}`);
    }

    if (metadata.parents?.includes(parentId)) {
      return;
    }

    const accessToken = await this.getAccessToken(userEmail);
    const params = new URLSearchParams({ addParents: parentId });

    const rootFolderId = this.env.GDRIVE_ROOT_FOLDER_ID;
    if (rootFolderId && metadata.parents?.includes(rootFolderId)) {
      params.append('removeParents', rootFolderId);
    }

    const response = await fetch(`${DRIVE_API_BASE}/files/${folderId}?${params.toString()}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to move Drive folder: ${error}`);
    }
  }

  /**
   * Get or create a folder for a work note
   */
  async getOrCreateWorkNoteFolder(userEmail: string, workId: string): Promise<GDriveFolderRecord> {
    // Check if folder already exists in DB
    const existing = await this.db
      .prepare(
        `SELECT work_id as workId, gdrive_folder_id as gdriveFolderId,
                gdrive_folder_link as gdriveFolderLink, created_at as createdAt
         FROM work_note_gdrive_folders
         WHERE work_id = ?`
      )
      .bind(workId)
      .first<GDriveFolderRecord>();

    const workNote = await this.db
      .prepare('SELECT created_at as createdAt FROM work_notes WHERE work_id = ?')
      .bind(workId)
      .first<{ createdAt: string }>();

    if (!workNote?.createdAt) {
      throw new Error(`Work note not found for workId: ${workId}`);
    }

    const year = this.buildYearFolderName(workNote.createdAt);
    const rootFolderId = this.env.GDRIVE_ROOT_FOLDER_ID;

    if (!rootFolderId) {
      throw new Error('GDRIVE_ROOT_FOLDER_ID is required to create Drive folders.');
    }

    const yearFolder =
      (await this.findFolderByNameInParent(userEmail, year, rootFolderId)) ??
      (await this.createFolder(userEmail, year, rootFolderId));

    if (existing) {
      await this.ensureFolderInParent(userEmail, existing.gdriveFolderId, yearFolder.id);
      return existing;
    }

    const folder = await this.createFolder(userEmail, workId, yearFolder.id);
    const now = new Date().toISOString();

    // Store in DB
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO work_note_gdrive_folders (work_id, gdrive_folder_id, gdrive_folder_link, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(workId, folder.id, folder.webViewLink, now)
      .run();

    return {
      workId,
      gdriveFolderId: folder.id,
      gdriveFolderLink: folder.webViewLink,
      createdAt: now,
    };
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(
    userEmail: string,
    folderId: string,
    file: Blob,
    fileName: string,
    mimeType: string,
    appProperties?: Record<string, string>
  ): Promise<DriveFile> {
    const accessToken = await this.getAccessToken(userEmail);

    // Use multipart upload for files
    const metadata: Record<string, unknown> = {
      name: fileName,
      parents: [folderId],
    };
    if (appProperties) {
      metadata.appProperties = appProperties;
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const fileContent = await file.arrayBuffer();

    // Build multipart body
    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const contentTypeHeader = encoder.encode(`${delimiter}Content-Type: ${mimeType}\r\n\r\n`);
    const closeBytes = encoder.encode(closeDelimiter);

    // Combine all parts
    const body = new Uint8Array(
      metadataBytes.length + contentTypeHeader.length + fileContent.byteLength + closeBytes.length
    );
    let offset = 0;
    body.set(metadataBytes, offset);
    offset += metadataBytes.length;
    body.set(contentTypeHeader, offset);
    offset += contentTypeHeader.length;
    body.set(new Uint8Array(fileContent), offset);
    offset += fileContent.byteLength;
    body.set(closeBytes, offset);

    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size,parents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    const data = (await response.json()) as DriveFile;
    return data;
  }

  /**
   * Find a file in a folder by appProperties key/value
   */
  async findFileByAppPropertyInFolder(
    userEmail: string,
    folderId: string,
    key: string,
    value: string
  ): Promise<DriveFile | null> {
    const accessToken = await this.getAccessToken(userEmail);
    const query = `appProperties has { key='${key}' and value='${value}' } and '${folderId}' in parents and trashed = false`;
    const url = `${DRIVE_API_BASE}/files?fields=files(id,name,mimeType,webViewLink,size,appProperties,parents)&q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    const data = (await response.json()) as { files?: DriveFile[] };
    return data.files?.[0] ?? null;
  }

  /**
   * List all files in a Google Drive folder (non-recursive)
   * Returns files sorted by modifiedTime descending
   */
  async listFilesInFolder(userEmail: string, folderId: string): Promise<DriveFile[]> {
    const accessToken = await this.getAccessToken(userEmail);
    const escapedFolderId = this.escapeQueryStringLiteral(folderId);
    const query = `'${escapedFolderId}' in parents and trashed = false`;
    const fields = 'files(id,name,mimeType,webViewLink,size,modifiedTime)';
    const orderBy = 'modifiedTime desc';

    const url = `${DRIVE_API_BASE}/files?fields=${encodeURIComponent(fields)}&q=${encodeURIComponent(query)}&orderBy=${encodeURIComponent(orderBy)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files in folder: ${error}`);
    }

    const data = (await response.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(userEmail: string, fileId: string): Promise<void> {
    const accessToken = await this.getAccessToken(userEmail);

    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Delete a folder from Google Drive
   */
  async deleteFolder(userEmail: string, folderId: string): Promise<void> {
    // Deleting a folder also deletes all files inside it
    await this.deleteFile(userEmail, folderId);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(userEmail: string, fileId: string): Promise<DriveFile | null> {
    const accessToken = await this.getAccessToken(userEmail);

    const response = await fetch(
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,webViewLink,size,parents`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get file metadata: ${error}`);
    }

    return (await response.json()) as DriveFile;
  }
}
