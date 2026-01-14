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

    const response = await fetch(`${DRIVE_API_BASE}/files?fields=id,name,webViewLink`, {
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

    if (existing) {
      return existing;
    }

    // Create new folder in Google Drive
    const folder = await this.createFolder(userEmail, workId);
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
    mimeType: string
  ): Promise<DriveFile> {
    const accessToken = await this.getAccessToken(userEmail);

    // Use multipart upload for files
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

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
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size`,
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
      `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,webViewLink,size`,
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
