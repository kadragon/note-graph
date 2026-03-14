// Trace: SPEC-rag-1, TASK-012, TASK-041, SPEC-refactor-embedding-service, TASK-REFACTOR-005
import type { RagContextSnippet, RagQueryFilters, RagQueryResponse } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import { pgPlaceholders } from '../utils/db-utils';
import { callOpenAIChat } from '../utils/openai-chat';
import { ChunkingService } from './chunking-service';
import { OpenAIEmbeddingService } from './openai-embedding-service';
import { DEFAULT_RAG_QUERY_PROMPT } from './setting-defaults';
import type { SettingService } from './setting-service';
import { VectorizeService } from './vectorize-service';

/**
 * RAG (Retrieval-Augmented Generation) service
 *
 * Implements contextual Q&A by:
 * 1. Retrieving relevant chunks via vector similarity search
 * 2. Constructing prompts with context
 * 3. Calling GPT-4.5 for answer generation
 */
export class RagService {
  private db: DatabaseClient;
  private vectorizeService: VectorizeService;
  private embeddingService: OpenAIEmbeddingService;
  private env: Env;
  private settingService?: SettingService;

  /** Minimum similarity score threshold for including chunks */
  private readonly SIMILARITY_THRESHOLD = 0.5;

  /** Default number of chunks to retrieve */
  private readonly DEFAULT_TOP_K = 5;

  /**
   * Maximum number of completion tokens for GPT API calls
   * Set to 1000 for concise RAG answers
   */
  private static readonly GPT_MAX_COMPLETION_TOKENS = 1000;

  constructor(db: DatabaseClient, env: Env, settingService?: SettingService) {
    this.db = db;
    this.env = env;
    this.settingService = settingService;
    this.embeddingService = new OpenAIEmbeddingService(env, settingService);
    this.vectorizeService = new VectorizeService(env.VECTORIZE);
  }

  private getModel(): string {
    return (
      this.settingService?.getConfigOrEnv('config.openai_model_chat', this.env.OPENAI_MODEL_CHAT) ??
      this.env.OPENAI_MODEL_CHAT
    );
  }

  /**
   * Execute RAG query
   *
   * @param query - User's natural language question
   * @param filters - Query filters (scope, person, department, work, topK)
   * @param env - Environment bindings (for AI Gateway)
   * @returns Answer with source context snippets
   */
  async query(query: string, filters: RagQueryFilters): Promise<RagQueryResponse> {
    const topK = filters.topK ?? this.DEFAULT_TOP_K;

    // Build Vectorize filter based on scope
    const vectorFilter = this.buildVectorFilter(filters);

    // Retrieve relevant chunks via vector search
    // For person scope, retrieve more results for post-filtering
    const searchLimit = filters.scope === 'person' ? topK * 3 : topK;
    const queryEmbedding = await this.embeddingService.embed(query);
    const vectorResponse = await this.vectorizeService.query(queryEmbedding, {
      topK: searchLimit,
      filter: vectorFilter,
      returnMetadata: true,
    });
    const vectorResults = vectorResponse.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: (match.metadata ?? {}) as Record<string, string>,
    }));

    // Filter chunks by similarity threshold
    const relevantChunks = vectorResults.filter((r) => r.score >= this.SIMILARITY_THRESHOLD);

    // If no relevant chunks found, return early
    if (relevantChunks.length === 0) {
      return {
        answer: '관련된 업무노트를 찾을 수 없습니다. 다른 질문을 시도해보세요.',
        contexts: [],
      };
    }

    // Fetch work note details for chunks (with PERSON scope filtering)
    const contexts = await this.buildContextSnippets(relevantChunks, filters);

    // Construct prompt with retrieved contexts
    const prompt = this.constructPrompt(query, contexts);

    // Call GPT-4.5 via AI Gateway
    const answer = await this.callGPT(prompt);

    return {
      answer,
      contexts,
    };
  }

  /**
   * Build Vectorize metadata filter based on RAG query filters
   * Note: Scope-specific parameter validation is handled at the route level
   */
  private buildVectorFilter(filters: RagQueryFilters): Record<string, string> | undefined {
    const vectorFilter: Record<string, string> = {};

    switch (filters.scope) {
      case 'work':
        // workId is guaranteed to exist due to route-level validation
        vectorFilter.work_id = filters.workId as string;
        break;

      case 'person':
        // personId is guaranteed to exist due to route-level validation
        // Note: person_ids is a comma-separated string in metadata
        // Vectorize doesn't support partial string matching, so we'll filter post-retrieval
        // For now, we retrieve more results and filter in buildContextSnippets
        break;

      case 'department':
        // deptName is guaranteed to exist due to route-level validation
        vectorFilter.dept_name = filters.deptName as string;
        break;
      default:
        // No scope filter - search across all work notes
        break;
    }

    return Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
  }

  /**
   * Build context snippets from vector search results
   *
   * Fetches work note details and extracts chunk text
   * Applies post-retrieval filtering for PERSON scope
   * Uses batch fetch to avoid N+1 query pattern
   */
  private async buildContextSnippets(
    vectorResults: Array<{ id: string; score: number; metadata: Record<string, string> }>,
    filters: RagQueryFilters
  ): Promise<RagContextSnippet[]> {
    // Apply person scope pre-filtering and parse work IDs
    const filteredResults = vectorResults.filter((result) => {
      if (filters.scope === 'person' && filters.personId) {
        const personIds = result.metadata.person_ids?.split(',') || [];
        return personIds.includes(filters.personId);
      }
      return true;
    });

    // Extract unique work IDs from chunk IDs
    const workIds = filteredResults.map((result) => ChunkingService.parseChunkId(result.id)[0]);
    const uniqueWorkIds = [...new Set(workIds)];

    // Batch fetch all work notes in a single query
    const workNotesMap = await this.fetchWorkNotesByIds(uniqueWorkIds);

    const snippets: RagContextSnippet[] = [];

    for (const result of filteredResults) {
      try {
        const [workId] = ChunkingService.parseChunkId(result.id);
        const workNote = workNotesMap.get(workId);
        if (!workNote) {
          continue;
        }

        const snippet = this.extractSnippet(workNote, result.metadata.chunk_index);

        snippets.push({
          workId: workNote.workId,
          title: workNote.title,
          snippet,
          score: result.score,
        });

        // Stop after reaching topK results (after filtering)
        if (snippets.length >= (filters.topK ?? this.DEFAULT_TOP_K)) {
          break;
        }
      } catch (error) {
        console.error('Error building context snippet:', error);
      }
    }

    return snippets;
  }

  /**
   * Batch fetch work notes by IDs
   * Eliminates N+1 query pattern by fetching all notes in a single query
   */
  private async fetchWorkNotesByIds(workIds: string[]): Promise<Map<string, WorkNote>> {
    if (workIds.length === 0) {
      return new Map();
    }

    const placeholders = pgPlaceholders(workIds.length);
    const { rows } = await this.db.query<WorkNote>(
      `SELECT work_id as "workId", title, content_raw as "contentRaw",
              category, created_at as "createdAt", updated_at as "updatedAt"
       FROM work_notes
       WHERE work_id IN (${placeholders})`,
      workIds
    );

    const map = new Map<string, WorkNote>();
    for (const note of rows) {
      map.set(note.workId, note);
    }
    return map;
  }

  /**
   * Extract snippet from work note based on chunk index
   *
   * Delegates to ChunkingService to avoid logic duplication
   */
  private extractSnippet(workNote: WorkNote, chunkIndexStr?: string): string {
    const fullText = `${workNote.title}\n\n${workNote.contentRaw}`;
    const chunkIndex = chunkIndexStr ? parseInt(chunkIndexStr, 10) : 0;

    // Use ChunkingService to extract snippet (avoids duplicating chunking logic)
    const chunkingService = new ChunkingService();
    return chunkingService.getChunkText(fullText, chunkIndex);
  }

  /**
   * Construct prompt with retrieved context chunks
   */
  private constructPrompt(query: string, contexts: RagContextSnippet[]): string {
    const contextText = contexts
      .map(
        (ctx, index) => `
[컨텍스트 ${index + 1}]
업무노트: ${ctx.title} (ID: ${ctx.workId})
내용:
${ctx.snippet}
`
      )
      .join('\n---\n');

    const template =
      this.settingService?.getValue('prompt.rag.query', DEFAULT_RAG_QUERY_PROMPT) ??
      DEFAULT_RAG_QUERY_PROMPT;
    return template.replace('{{CONTEXT_TEXT}}', contextText).replace('{{QUERY}}', query);
  }

  /**
   * Call GPT via AI Gateway using shared utility
   * Uses system/user message separation for OpenAI system prompt caching
   */
  private async callGPT(prompt: string): Promise<string> {
    return callOpenAIChat(this.env, {
      messages: [{ role: 'user', content: prompt }],
      model: this.getModel(),
      maxCompletionTokens: RagService.GPT_MAX_COMPLETION_TOKENS,
    });
  }
}
