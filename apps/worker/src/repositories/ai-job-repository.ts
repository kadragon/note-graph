import type { DatabaseClient } from '../types/database';

export type AiJobStatus = 'pending' | 'completed' | 'failed';

export interface AiJob {
  jobId: string;
  type: string;
  status: AiJobStatus;
  result: unknown | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface AiJobRow {
  job_id: string;
  type: string;
  status: AiJobStatus;
  result: unknown | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export class AiJobRepository {
  constructor(private db: DatabaseClient) {}

  private toAiJob(row: AiJobRow): AiJob {
    return {
      jobId: row.job_id,
      type: row.type,
      status: row.status,
      result: row.result,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  async create(jobId: string, type: string): Promise<void> {
    await this.db.execute(`INSERT INTO ai_jobs (job_id, type, status) VALUES ($1, $2, 'pending')`, [
      jobId,
      type,
    ]);
  }

  async findById(jobId: string): Promise<AiJob | null> {
    const row = await this.db.queryOne<AiJobRow>('SELECT * FROM ai_jobs WHERE job_id = $1', [
      jobId,
    ]);
    return row ? this.toAiJob(row) : null;
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    await this.db.execute(
      `UPDATE ai_jobs SET status = 'completed', result = $1, completed_at = now() WHERE job_id = $2`,
      [JSON.stringify(result), jobId]
    );
  }

  async fail(jobId: string, error: string): Promise<void> {
    await this.db.execute(
      `UPDATE ai_jobs SET status = 'failed', error = $1, completed_at = now() WHERE job_id = $2`,
      [error, jobId]
    );
  }

  async deleteOlderThan(hours: number): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM ai_jobs WHERE created_at < now() - make_interval(hours => $1)`,
      [hours]
    );
    return result.rowCount;
  }
}
