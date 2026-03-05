import { D1FtsDialect } from '../adapters/d1-fts-dialect';
import type { DatabaseClient } from '../types/database';
import type { FtsDialect } from '../types/fts-dialect';
import {
  buildMeetingMinutesFtsQuery,
  buildMeetingMinutesTsQuery,
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
  constructor(
    private db: DatabaseClient,
    private dialect: FtsDialect = new D1FtsDialect()
  ) {}

  async search(
    query: string,
    limit: number,
    minScore: number = 0
  ): Promise<MeetingMinuteReference[]> {
    const ftsQuery = this.dialect.isTsQuerySyntax()
      ? buildMeetingMinutesTsQuery(query)
      : buildMeetingMinutesFtsQuery(query);

    if (ftsQuery.length === 0) {
      return [];
    }

    // Over-fetch to compensate for minScore filtering
    const FETCH_MULTIPLIER = 3;
    const cte = this.dialect.buildMeetingMinuteFtsCteWithLimit();
    const { rows } = await this.db.query<MeetingMinuteFtsRow>(
      `${cte.sql}
         SELECT
           mm.meeting_id as meetingId,
           mm.meeting_date as meetingDate,
           mm.topic as topic,
           mm.keywords_json as keywordsJson,
           fts.${cte.rankColumn} as ftsRank
         FROM fts_matches fts
         INNER JOIN meeting_minutes mm ON ${cte.joinCondition}
         ORDER BY fts.${cte.rankColumn} ASC`,
      [ftsQuery, limit * FETCH_MULTIPLIER]
    );

    return mapMeetingMinutesFtsScores(rows)
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
