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
export type RagScope = 'global' | 'person' | 'department' | 'work' | 'project';

/**
 * RAG query filters
 */
export interface RagQueryFilters {
  scope?: RagScope;
  personId?: string;
  deptName?: string;
  workId?: string;
  projectId?: string;
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
  relatedPersonIds?: string[];
  todos: AIDraftTodo[];
}

/**
 * Simplified todo for AI reference context
 */
export interface ReferenceTodo {
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
}

/**
 * Similar work note reference used during AI draft generation
 */
export interface SimilarWorkNoteReference {
  workId: string;
  title: string;
  content: string;
  category?: string;
  similarityScore: number;
  todos?: ReferenceTodo[];
}

/**
 * AI-suggested todo item
 * Note: dueDate is always populated (defaults to today if not inferred by LLM)
 */
export interface AIDraftTodo {
  title: string;
  description: string;
  dueDate: string;
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
  project_id?: string;
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

/**
 * Person search result item
 */
export interface PersonSearchItem {
  personId: string;
  name: string;
  currentDept: string | null;
  currentPosition: string | null;
  phoneExt: string | null;
  employmentStatus: string;
}

/**
 * Department search result item
 */
export interface DepartmentSearchItem {
  deptName: string;
  description: string | null;
  isActive: boolean;
}

/**
 * Unified search response with all result types
 */
export interface UnifiedSearchResponse {
  workNotes: SearchResultItem[];
  persons: PersonSearchItem[];
  departments: DepartmentSearchItem[];
  query: string;
}

/**
 * Enhance work note request
 */
export interface EnhanceWorkNoteRequest {
  newContent: string;
  generateNewTodos?: boolean;
}

/**
 * Existing todo summary for enhance response
 */
export interface ExistingTodoSummary {
  todoId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
}

/**
 * Enhance work note response
 */
export interface EnhanceWorkNoteResponse {
  enhancedDraft: WorkNoteDraft;
  originalContent: string;
  existingTodos: ExistingTodoSummary[];
  references: SimilarWorkNoteReference[];
}
