// Trace: SPEC-rag-1, TASK-012
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import type { RagQueryFilters, RagQueryResponse, RagContextSnippet } from '../types/search';
import type { WorkNote } from '../types/work-note';
import { EmbeddingService, VectorizeService } from './embedding-service';
import { ChunkingService } from './chunking-service';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders } from '../utils/ai-gateway';

/**
 * RAG (Retrieval-Augmented Generation) service
 *
 * Implements contextual Q&A by:
 * 1. Retrieving relevant chunks via vector similarity search
 * 2. Constructing prompts with context
 * 3. Calling GPT-4.5 for answer generation
 */
export class RagService {
  private db: D1Database;
  private vectorizeService: VectorizeService;
  private embeddingService: EmbeddingService;
  private env: Env;

  /** Minimum similarity score threshold for including chunks */
  private readonly SIMILARITY_THRESHOLD = 0.5;

  /** Default number of chunks to retrieve */
  private readonly DEFAULT_TOP_K = 5;

  constructor(env: Env) {
    this.env = env;
    this.db = env.DB;
    this.embeddingService = new EmbeddingService(env);
    this.vectorizeService = new VectorizeService(env.VECTORIZE, this.embeddingService);
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
    const vectorResults = await this.vectorizeService.search(query, searchLimit, vectorFilter);

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
        vectorFilter.work_id = filters.workId!;
        break;

      case 'person':
        // personId is guaranteed to exist due to route-level validation
        // Note: person_ids is a comma-separated string in metadata
        // Vectorize doesn't support partial string matching, so we'll filter post-retrieval
        // For now, we retrieve more results and filter in buildContextSnippets
        break;

      case 'department':
        // deptName is guaranteed to exist due to route-level validation
        vectorFilter.dept_name = filters.deptName!;
        break;

      case 'global':
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
   */
  private async buildContextSnippets(
    vectorResults: Array<{ id: string; score: number; metadata: Record<string, string> }>,
    filters: RagQueryFilters
  ): Promise<RagContextSnippet[]> {
    const snippets: RagContextSnippet[] = [];

    for (const result of vectorResults) {
      try {
        // Apply person scope post-filtering
        if (filters.scope === 'person' && filters.personId) {
          const personIds = result.metadata.person_ids?.split(',') || [];
          if (!personIds.includes(filters.personId)) {
            continue; // Skip chunks not associated with this person
          }
        }

        // Parse chunk ID to get work ID
        const [workId] = ChunkingService.parseChunkId(result.id);

        // Fetch work note from D1
        const workNote = await this.fetchWorkNote(workId);
        if (!workNote) {
          continue;
        }

        // Extract chunk text from metadata or reconstruct
        // For now, we'll use a snippet from the work note content
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
        // Skip this chunk and continue
      }
    }

    return snippets;
  }

  /**
   * Fetch work note by ID from D1
   */
  private async fetchWorkNote(workId: string): Promise<WorkNote | null> {
    const result = await this.db
      .prepare(
        `SELECT work_id as workId, title, content_raw as contentRaw,
                category, created_at as createdAt, updated_at as updatedAt
         FROM work_notes
         WHERE work_id = ?`
      )
      .bind(workId)
      .first<WorkNote>();

    return result || null;
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

    return `당신은 업무노트에 대한 질문에 답변하는 어시스턴트입니다.

다음 컨텍스트를 사용하여 사용자의 질문에 답변하세요.
컨텍스트에 관련 정보가 없으면 그렇게 말하세요.

${contextText}

---

질문: ${query}

답변은 한국어로 작성하고, 간결하게 작성하며, 가능한 경우 특정 업무노트를 참조하세요.`;
  }

  /**
   * Call GPT-4.5 via AI Gateway
   */
  private async callGPT(prompt: string): Promise<string> {
    const url = `https://gateway.ai.cloudflare.com/v1/${this.env.CLOUDFLARE_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/openai/chat/completions`;

    const requestBody = {
      model: this.env.OPENAI_MODEL_CHAT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: getAIGatewayHeaders(this.env),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new RateLimitError('AI 호출 상한을 초과했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json<{
      choices: Array<{ message: { content: string } }>;
    }>();

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No response from GPT');
    }

    return data.choices[0].message.content;
  }
}
