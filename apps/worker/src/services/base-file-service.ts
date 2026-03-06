// Trace: SPEC-refactor-file-service, TASK-REFACTOR-003
/**
 * Shared file service utilities for R2-backed file storage.
 */

import type { R2Bucket, R2Object, R2ObjectBody } from '@cloudflare/workers-types';
import type { DatabaseClient } from '../types/database';
import { BadRequestError, NotFoundError } from '../types/errors';
import { pgPlaceholders } from '../utils/db-utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];

export interface BaseFileRecord {
  fileId: string;
  r2Key?: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  deletedAt: string | null;
}

interface InsertFileRecordParams {
  ownerId: string;
  fileId: string;
  r2Key: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  additionalColumns?: { names: string[]; values: unknown[] };
}

export abstract class BaseFileService<TFile extends BaseFileRecord> {
  protected abstract tableName: string;
  protected abstract ownerIdColumn: string;

  constructor(
    protected r2: R2Bucket,
    protected db: DatabaseClient
  ) {}

  protected abstract buildR2Key(ownerId: string, fileId: string): string;
  protected abstract mapDbToFile(row: Record<string, unknown>): TFile;
  protected abstract getAllowedMimeTypes(): string[];
  protected abstract getExtensionMimeMap(): Record<string, string>;
  protected abstract getUnsupportedFileMessage(): string;

  private formatUnsupportedFileMessage(mimeType: string): string {
    const fileType = mimeType.trim() || '(empty)';
    return `${this.getUnsupportedFileMessage()} (file.type: ${fileType})`;
  }

  protected validateFileSize(file: Blob): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError(
        `파일 크기가 제한을 초과했습니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 업로드 가능합니다.`
      );
    }
  }

  protected resolveFileType(originalName: string, mimeType: string): string {
    let normalizedMime = (mimeType || '').trim().toLowerCase();
    if (normalizedMime === 'image/jpg') {
      normalizedMime = 'image/jpeg';
    }
    const extension = originalName.toLowerCase().split('.').pop();

    const isHwpxFromGenericZip =
      extension === 'hwpx' &&
      (normalizedMime === 'application/zip' || normalizedMime === 'application/x-zip-compressed');

    if (
      ['application/hwp+zip', 'application/haansofthwpx'].includes(normalizedMime) ||
      isHwpxFromGenericZip
    ) {
      normalizedMime = 'application/vnd.hancom.hwpx';
    }

    if (normalizedMime && this.getAllowedMimeTypes().includes(normalizedMime)) {
      return normalizedMime;
    }

    if (normalizedMime && !GENERIC_MIME_TYPES.includes(normalizedMime)) {
      throw new BadRequestError(this.formatUnsupportedFileMessage(mimeType));
    }

    if (extension) {
      const extensionMap = this.getExtensionMimeMap();
      const mapped = extensionMap[extension];
      if (mapped) {
        return mapped;
      }
    }

    throw new BadRequestError(this.formatUnsupportedFileMessage(mimeType));
  }

  protected async putFileObject(params: {
    r2Key: string;
    file: Blob;
    fileType: string;
    customMetadata: Record<string, string>;
  }): Promise<void> {
    const { r2Key, file, fileType, customMetadata } = params;

    await this.r2.put(r2Key, file, {
      httpMetadata: {
        contentType: fileType,
      },
      customMetadata,
    });
  }

  protected async insertFileRecord(params: InsertFileRecordParams): Promise<void> {
    const {
      ownerId,
      fileId,
      r2Key,
      originalName,
      fileType,
      fileSize,
      uploadedBy,
      uploadedAt,
      additionalColumns,
    } = params;

    const columnNames = [
      'file_id',
      this.ownerIdColumn,
      'r2_key',
      'original_name',
      'file_type',
      'file_size',
      'uploaded_by',
      'uploaded_at',
    ];

    const values: unknown[] = [
      fileId,
      ownerId,
      r2Key,
      originalName,
      fileType,
      fileSize,
      uploadedBy,
      uploadedAt,
    ];

    if (additionalColumns) {
      columnNames.push(...additionalColumns.names);
      values.push(...additionalColumns.values);
    }

    const placeholders = pgPlaceholders(columnNames.length);

    await this.db.execute(
      `INSERT INTO ${this.tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }

  async getFileById(fileId: string): Promise<TFile | null> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE file_id = $1 AND deleted_at IS NULL`,
      [fileId]
    );

    if (!result) return null;

    return this.mapDbToFile(result);
  }

  async listFiles(ownerId: string): Promise<TFile[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName}
       WHERE ${this.ownerIdColumn} = $1 AND deleted_at IS NULL
       ORDER BY uploaded_at DESC`,
      [ownerId]
    );

    return rows.map((r) => this.mapDbToFile(r));
  }

  async streamFile(
    fileId: string,
    inline = false
  ): Promise<{ body: ReadableStream; headers: Headers }> {
    const file = await this.requireFile(fileId);
    if (!file.r2Key) {
      throw new NotFoundError('File in R2', file.fileId);
    }

    const object = await this.r2.get(file.r2Key);
    if (!object) {
      throw new NotFoundError('File in R2', file.r2Key);
    }

    const headers = new Headers();
    headers.set('Content-Type', file.fileType);
    headers.set('Content-Length', file.fileSize.toString());
    headers.set('Content-Disposition', this.buildContentDisposition(file.originalName, inline));

    return {
      body: object.body,
      headers,
    };
  }

  protected async requireFile(fileId: string): Promise<TFile> {
    const file = await this.getFileById(fileId);
    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    return file;
  }

  protected async softDeleteFileRecord(fileId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(`UPDATE ${this.tableName} SET deleted_at = $1 WHERE file_id = $2`, [
      now,
      fileId,
    ]);
  }

  protected async deleteR2Object(r2Key: string): Promise<void> {
    await this.r2.delete(r2Key);
  }

  protected buildContentDisposition(originalName: string, inline: boolean): string {
    const encodedName = encodeURIComponent(originalName);
    return inline ? `inline; filename="${encodedName}"` : `attachment; filename="${encodedName}"`;
  }

  protected extractR2Metadata(object: R2ObjectBody): {
    httpMetadata?: R2Object['httpMetadata'];
    customMetadata?: R2Object['customMetadata'];
  } {
    const metadata: {
      httpMetadata?: R2Object['httpMetadata'];
      customMetadata?: R2Object['customMetadata'];
    } = {};

    if ('httpMetadata' in object && object.httpMetadata) {
      metadata.httpMetadata = object.httpMetadata;
    }

    if ('customMetadata' in object && object.customMetadata) {
      metadata.customMetadata = object.customMetadata;
    }

    return metadata;
  }
}
