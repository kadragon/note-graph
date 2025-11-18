// Trace: SPEC-search-1, TASK-009
import type { WorkNote } from './work-note';

/**
 * Search result source type
 */
export type SearchSource = 'LEXICAL' | 'SEMANTIC' | 'HYBRID';

/**
 * Search result item combining work note with search metadata
 */
export interface SearchResultItem {
  workNote: WorkNote;
  score: number;
  source: SearchSource;
}

/**
 * Search filters for work notes
 */
export interface SearchFilters {
  personId?: string;
  deptName?: string;
  category?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
}

/**
 * RAG context snippet from retrieved chunks
 */
export interface RagContextSnippet {
  workId: string;
  title: string;
  snippet: string;
  score: number;
}

/**
 * RAG query scope
 */
export type RagScope = 'GLOBAL' | 'PERSON' | 'DEPARTMENT' | 'WORK';

/**
 * RAG query filters
 */
export interface RagQueryFilters {
  scope?: RagScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  topK?: number;
}

/**
 * RAG query response
 */
export interface RagQueryResponse {
  answer: string;
  contexts: RagContextSnippet[];
}

/**
 * AI-generated work note draft
 */
export interface WorkNoteDraft {
  title: string;
  content: string;
  category: string;
  todos: AIDraftTodo[];
}

/**
 * AI-suggested todo item
 */
export interface AIDraftTodo {
  title: string;
  description: string;
  dueDateSuggestion: string | null;
  repeatRule?: {
    interval: number;
    unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  } | null;
}

/**
 * Chunk metadata for Vectorize
 */
export interface ChunkMetadata {
  work_id: string;
  scope: string;
  person_ids?: string;
  dept_name?: string;
  category?: string;
  created_at_bucket: string; // YYYY-MM-DD format
  chunk_index: number;
}

/**
 * Text chunk with metadata
 */
export interface TextChunk {
  text: string;
  metadata: ChunkMetadata;
}
