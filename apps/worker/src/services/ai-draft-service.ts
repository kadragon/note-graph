// Trace: SPEC-ai-draft-1, TASK-013
/**
 * AI draft service for work note generation using GPT-4.5
 */

import type { AIDraftTodo, ReferenceTodo, WorkNoteDraft } from '@shared/types/search';
import type { WorkNote } from '@shared/types/work-note';
import type { Env } from '../types/env';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { getTodayDateUTC } from '../utils/date';

/**
 * Raw todo structure returned by LLM
 */
interface RawAIDraftTodo {
  title: string;
  description: string;
  dueDateSuggestion?: string | null;
  repeatRule?: {
    interval: number;
    unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  } | null;
}

/**
 * Raw draft structure returned by LLM
 */
interface RawWorkNoteDraft {
  title: string;
  content: string;
  category: string;
  todos: RawAIDraftTodo[];
}

/**
 * AI Draft Service
 *
 * Generates work note drafts and todo suggestions using GPT-4.5 via AI Gateway
 */
export class AIDraftService {
  /**
   * Maximum number of completion tokens for GPT API calls
   * Set to 3000 to allow comprehensive responses for work note drafts
   */
  private static readonly GPT_MAX_COMPLETION_TOKENS = 3000;

  /**
   * Maximum characters to include from similar note content for context preview
   */
  private static readonly SIMILAR_NOTE_CONTENT_PREVIEW_LENGTH = 200;

  constructor(private env: Env) {}

  /**
   * Transform raw LLM todo to proper AIDraftTodo format
   * Defaults null/undefined due dates to today's date (UTC)
   */
  private transformTodo(rawTodo: RawAIDraftTodo): AIDraftTodo {
    return {
      title: rawTodo.title,
      description: rawTodo.description,
      dueDate: rawTodo.dueDateSuggestion || getTodayDateUTC(),
      repeatRule: rawTodo.repeatRule,
    };
  }

  /**
   * Transform raw LLM draft to proper WorkNoteDraft format
   */
  private transformDraft(rawDraft: RawWorkNoteDraft, personIds?: string[]): WorkNoteDraft {
    return {
      title: rawDraft.title,
      content: rawDraft.content,
      category: rawDraft.category,
      relatedPersonIds: personIds && personIds.length > 0 ? personIds : undefined,
      todos: rawDraft.todos.map((todo) => this.transformTodo(todo)),
    };
  }

  /**
   * Generate work note draft from unstructured text input
   *
   * @param inputText - Unstructured text about work
   * @param options - Optional hints (category, personIds, deptName, activeCategories)
   * @returns Work note draft with title, content, category, and todo suggestions
   */
  async generateDraftFromText(
    inputText: string,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
      activeCategories?: string[];
    }
  ): Promise<WorkNoteDraft> {
    const prompt = this.constructDraftPrompt(inputText, options);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const rawDraft = JSON.parse(response) as RawWorkNoteDraft;

      // Validate required fields
      if (!rawDraft.title || !rawDraft.content) {
        throw new Error('Invalid draft: missing title or content');
      }

      // Transform to proper format with default due dates and personIds
      return this.transformDraft(rawDraft, options?.personIds);
    } catch (error) {
      console.error('Error parsing draft response:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  /**
   * Generate work note draft from unstructured text with similar work notes as context
   *
   * @param inputText - Unstructured text about work
   * @param similarNotes - Similar work notes to use as reference
   * @param options - Optional hints (category, personIds, deptName, activeCategories)
   * @returns Work note draft with title, content, category, and todo suggestions
   */
  async generateDraftFromTextWithContext(
    inputText: string,
    similarNotes: Array<{
      workId: string;
      title: string;
      content: string;
      category?: string;
      similarityScore?: number;
    }>,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
      activeCategories?: string[];
    }
  ): Promise<WorkNoteDraft> {
    const prompt = this.constructDraftPromptWithContext(inputText, similarNotes, options);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const rawDraft = JSON.parse(response) as RawWorkNoteDraft;

      // Validate required fields
      if (!rawDraft.title || !rawDraft.content) {
        throw new Error('Invalid draft: missing title or content');
      }

      // Transform to proper format with default due dates and personIds
      return this.transformDraft(rawDraft, options?.personIds);
    } catch (error) {
      console.error('Error parsing draft response:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  /**
   * Generate todo suggestions for existing work note
   *
   * @param workNote - Existing work note
   * @param contextText - Optional additional context
   * @returns Array of todo suggestions
   */
  async generateTodoSuggestions(workNote: WorkNote, contextText?: string): Promise<AIDraftTodo[]> {
    const prompt = this.constructTodoSuggestionsPrompt(workNote, contextText);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const rawTodos = JSON.parse(response) as RawAIDraftTodo[];

      // Validate array
      if (!Array.isArray(rawTodos)) {
        throw new Error('Invalid response: expected array of todos');
      }

      // Transform to proper format with default due dates
      return rawTodos.map((todo) => this.transformTodo(todo));
    } catch (error) {
      console.error('Error parsing todo suggestions:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  /**
   * Reference todo structure for enhance prompt
   */
  private formatExistingTodo(todo: {
    title: string;
    description?: string | null;
    status: string;
    dueDate?: string | null;
  }): string {
    let line = `- ${todo.title}`;
    if (todo.dueDate) {
      line += ` (기한: ${todo.dueDate})`;
    }
    if (todo.status !== '진행중') {
      line += ` [${todo.status}]`;
    }
    return line;
  }

  /**
   * Enhance existing work note by merging new content with existing content
   *
   * @param workNote - Existing work note to enhance
   * @param existingTodos - Current todos for this work note
   * @param newContent - New content to merge (from user input or extracted from file)
   * @param options - Optional hints (similarNotes, activeCategories)
   * @returns Enhanced work note draft with merged content and new todo suggestions
   */
  async enhanceExistingWorkNote(
    workNote: WorkNote,
    existingTodos: Array<{
      title: string;
      description?: string | null;
      status: string;
      dueDate?: string | null;
    }>,
    newContent: string,
    options?: {
      similarNotes?: Array<{
        workId: string;
        title: string;
        content: string;
        category?: string;
        similarityScore?: number;
      }>;
      activeCategories?: string[];
    }
  ): Promise<WorkNoteDraft> {
    const prompt = this.constructEnhancePrompt(workNote, existingTodos, newContent, options);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const rawDraft = JSON.parse(response) as RawWorkNoteDraft;

      // Validate required fields
      if (!rawDraft.title || !rawDraft.content) {
        throw new Error('Invalid draft: missing title or content');
      }

      // Transform to proper format
      return this.transformDraft(rawDraft);
    } catch (error) {
      console.error('Error parsing enhance response:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }

  /**
   * Construct prompt for enhancing existing work note
   */
  private constructEnhancePrompt(
    workNote: WorkNote,
    existingTodos: Array<{
      title: string;
      description?: string | null;
      status: string;
      dueDate?: string | null;
    }>,
    newContent: string,
    options?: {
      similarNotes?: Array<{
        workId: string;
        title: string;
        content: string;
        category?: string;
        similarityScore?: number;
      }>;
      activeCategories?: string[];
    }
  ): string {
    // Build existing todos section
    const existingTodosSection =
      existingTodos.length > 0
        ? `\n\n[기존 할 일 목록 - 참고만 하고 중복 생성 금지]\n${existingTodos.map((todo) => this.formatExistingTodo(todo)).join('\n')}`
        : '';

    // Build similar notes context
    const similarNotesSection =
      options?.similarNotes && options.similarNotes.length > 0
        ? `\n\n[유사 업무노트 - 스타일 참고]\n${options.similarNotes
            .map(
              (note, idx) =>
                `[참고 ${idx + 1}] ${note.title}\n카테고리: ${note.category || '없음'}\n내용 요약: ${note.content.slice(0, AIDraftService.SIMILAR_NOTE_CONTENT_PREVIEW_LENGTH)}...`
            )
            .join('\n\n')}`
        : '';

    const categoryInstruction = this.buildCategoryInstruction(
      options?.activeCategories,
      workNote.category
        ? `3. 카테고리 (기존: "${workNote.category}", 변경 필요시에만 수정)`
        : '3. 카테고리 추론'
    );

    return `당신은 한국 직장에서 업무노트를 업데이트하는 어시스턴트입니다.

사용자가 기존 업무노트에 새로운 내용을 추가하려고 합니다.

[기존 업무노트]
제목: ${workNote.title}
카테고리: ${workNote.category || '없음'}
내용:
${workNote.contentRaw}${existingTodosSection}

[추가할 새 내용]
${newContent}${similarNotesSection}

위의 기존 업무노트와 새 내용을 **통합하여** 다음을 작성해주세요:
1. 업데이트된 제목 (기존 제목 유지 또는 필요시 수정)
2. 통합된 내용 (기존 내용 + 새 내용을 자연스럽게 병합, 마크다운 포맷)
${categoryInstruction}
4. **새로운** 할 일만 제안 (기존 할 일과 중복되지 않는 것만, 필요한 만큼만)

중요 지침:
- 기존 내용의 핵심 정보를 **반드시 보존**하세요
- 새 내용을 기존 내용과 자연스럽게 통합하세요
- 기존 할 일과 중복되는 할 일은 **절대 제안하지 마세요**
- 내용은 간결하게, 불필요한 반복 없이 작성하세요

JSON 형식으로 반환:
{
  "title": "...",
  "content": "...",
  "category": "...",
  "todos": [
    {
      "title": "...",
      "description": "...",
      "dueDateSuggestion": "YYYY-MM-DD" 또는 null
    }
  ]
}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * Build category instruction for AI prompt
   * @param activeCategories - List of active category names, or undefined
   * @param fallback - Fallback instruction when no active categories
   */
  private buildCategoryInstruction(activeCategories?: string[], fallback?: string): string {
    if (activeCategories && activeCategories.length > 0) {
      const categoryList = activeCategories.join(', ');
      return `3. 제안 카테고리 (다음 중에서 가장 적합한 1개를 선택: ${categoryList})`;
    }
    return (
      fallback || '3. 제안 카테고리 (수업성적, KORUS, 기획, 행정 중 하나 또는 새로운 카테고리 추론)'
    );
  }

  /**
   * Construct prompt for draft generation from text
   */
  private constructDraftPrompt(
    inputText: string,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
      activeCategories?: string[];
    }
  ): string {
    const categoryHint = options?.category ? `\n\n카테고리 힌트: ${options.category}` : '';
    const deptHint = options?.deptName ? `\n\n부서 컨텍스트: ${options.deptName}` : '';
    const categoryInstruction = this.buildCategoryInstruction(options?.activeCategories);

    return `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

${inputText}${categoryHint}${deptHint}

이를 분석하여 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용)
${categoryInstruction}
4. 내용에 적합한 개수의 관련 할 일 항목과 제안 기한 (필요한 만큼만 생성, 억지로 개수를 맞추지 말 것)

중요: 내용은 핵심만 간결하게 작성하세요. 불필요한 설명이나 반복을 피하고, 실제 업무에 필요한 정보만 포함하세요.

JSON 형식으로 반환:
{
  "title": "...",
  "content": "...",
  "category": "...",
  "todos": [
    {
      "title": "...",
      "description": "...",
      "dueDateSuggestion": "YYYY-MM-DD" 또는 null
    }
  ]
}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * Construct prompt for draft generation from text with similar work notes as context
   */
  private constructDraftPromptWithContext(
    inputText: string,
    similarNotes: Array<{
      title: string;
      content: string;
      category?: string;
      todos?: ReferenceTodo[];
    }>,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
      activeCategories?: string[];
    }
  ): string {
    const categoryHint = options?.category ? `\n\n카테고리 힌트: ${options.category}` : '';
    const deptHint = options?.deptName ? `\n\n부서 컨텍스트: ${options.deptName}` : '';

    // Build context from similar notes
    const contextText =
      similarNotes.length > 0
        ? `\n\n[이전 업무노트 - 참고용]
아래는 유사한 이전 업무노트들입니다. 형식, 스타일, 할 일 패턴을 참고하고, 내용은 새로운 업무에 맞게 작성하세요:
${similarNotes
  .map((note, idx) => {
    // Build todos section if available
    const todosSection =
      note.todos && note.todos.length > 0
        ? `\n할 일 목록:
${note.todos.map((todo) => `  - ${todo.title}${todo.dueDate ? ` (기한: ${todo.dueDate})` : ''}${todo.status !== '진행중' ? ` [${todo.status}]` : ''}`).join('\n')}`
        : '';

    return `
[참고 노트 ${idx + 1}]
제목: ${note.title}
카테고리: ${note.category || '없음'}
내용 요약: ${note.content.slice(0, 300)}...${todosSection}
`;
  })
  .join('\n')}`
        : '';

    const categoryInstruction = this.buildCategoryInstruction(
      options?.activeCategories,
      '3. 제안 카테고리 (유사 노트에서 사용된 카테고리 우선 고려, 또는 새로운 카테고리 추론)'
    );

    return `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

${inputText}${categoryHint}${deptHint}${contextText}

위의 유사한 업무노트들을 참고하여 일관된 형식과 카테고리를 사용하면서, 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어, 유사 노트의 제목 스타일 참고)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용, 유사 노트의 구조 참고)
${categoryInstruction}
4. 내용에 적합한 개수의 관련 할 일 항목과 제안 기한 (유사 노트의 할 일 패턴 참고, 필요한 만큼만 생성)

중요: 내용은 핵심만 간결하게 작성하세요. 불필요한 설명이나 반복을 피하고, 실제 업무에 필요한 정보만 포함하세요.

JSON 형식으로 반환:
{
  "title": "...",
  "content": "...",
  "category": "...",
  "todos": [
    {
      "title": "...",
      "description": "...",
      "dueDateSuggestion": "YYYY-MM-DD" 또는 null
    }
  ]
}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * Construct prompt for todo suggestions
   */
  private constructTodoSuggestionsPrompt(workNote: WorkNote, contextText?: string): string {
    const context = contextText ? `\n\n추가 컨텍스트:\n${contextText}` : '';

    return `당신은 업무노트에 대한 할 일을 제안하는 어시스턴트입니다.

업무노트:
제목: ${workNote.title}
내용: ${workNote.contentRaw}
카테고리: ${workNote.category || '없음'}${context}

이 업무노트를 기반으로 실행 가능한 할 일을 제안해주세요. (내용에 적합한 개수만큼 생성, 억지로 개수를 맞추지 말 것)

JSON 배열로 반환:
[
  {
    "title": "...",
    "description": "...",
    "dueDateSuggestion": "YYYY-MM-DD" 또는 null
  }
]

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * Call GPT-4.5 via AI Gateway
   *
   * @param prompt - Prompt for GPT
   * @returns GPT response text
   */
  private async callGPT(prompt: string): Promise<string> {
    const url = getAIGatewayUrl(this.env, 'chat/completions');

    const model = this.env.OPENAI_MODEL_CHAT;

    const requestBody = {
      model,
      messages: [
        {
          role: 'user' as const,
          content: prompt,
        },
      ],
      max_completion_tokens: AIDraftService.GPT_MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_object' as const },
      // Reasoning models (o1, o3, gpt-5) don't support temperature parameter
      ...(!isReasoningModel(model) && { temperature: 0.7 }),
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
