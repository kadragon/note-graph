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

export class MeetingMinuteReferenceService {
  constructor(private db: D1Database) {}

  async search(query: string, limit: number): Promise<MeetingMinuteReference[]> {
    const ftsQuery = buildMeetingMinutesFtsQuery(query);

    if (ftsQuery.length === 0) {
      return [];
    }

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
      .bind(ftsQuery, limit)
      .all<MeetingMinuteFtsRow>();

    return mapMeetingMinutesFtsScores(result.results || []).map((row) => ({
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      topic: row.topic,
      keywords: JSON.parse(row.keywordsJson || '[]') as string[],
      score: row.score,
    }));
  }
}
