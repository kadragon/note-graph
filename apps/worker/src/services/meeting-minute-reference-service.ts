import type { D1Database } from '@cloudflare/workers-types';
import {
  buildMeetingMinutesFtsQuery,
  mapMeetingMinutesFtsScores,
} from '../utils/meeting-minutes-fts';

interface MeetingMinuteFtsRow {
  meetingId: string;
  meetingDate: string;
  topic: string;
  keywordsJson: string;
  ftsRank: number;
}

export interface MeetingMinuteReference {
  meetingId: string;
  meetingDate: string;
  topic: string;
  keywords: string[];
  score: number;
}

function safeParseJsonArray(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class MeetingMinuteReferenceService {
  constructor(private db: D1Database) {}

  async search(
    query: string,
    limit: number,
    minScore: number = 0
  ): Promise<MeetingMinuteReference[]> {
    const ftsQuery = buildMeetingMinutesFtsQuery(query);

    if (ftsQuery.length === 0) {
      return [];
    }

    // Over-fetch to compensate for minScore filtering
    const FETCH_MULTIPLIER = 3;
    const result = await this.db
      .prepare(
        `WITH fts_matches AS (
           SELECT rowid, rank
           FROM meeting_minutes_fts
           WHERE meeting_minutes_fts MATCH ?
           ORDER BY rank ASC
           LIMIT ?
         )
         SELECT
           mm.meeting_id as meetingId,
           mm.meeting_date as meetingDate,
           mm.topic as topic,
           mm.keywords_json as keywordsJson,
           fts.rank as ftsRank
         FROM fts_matches fts
         INNER JOIN meeting_minutes mm ON mm.rowid = fts.rowid
         ORDER BY fts.rank ASC`
      )
      .bind(ftsQuery, limit * FETCH_MULTIPLIER)
      .all<MeetingMinuteFtsRow>();

    return mapMeetingMinutesFtsScores(result.results || [])
      .filter((row) => row.score >= minScore)
      .slice(0, limit)
      .map((row) => ({
        meetingId: row.meetingId,
        meetingDate: row.meetingDate,
        topic: row.topic,
        keywords: safeParseJsonArray(row.keywordsJson),
        score: row.score,
      }));
  }
}
