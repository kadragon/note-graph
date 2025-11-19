// Trace: SPEC-ai-draft-1, TASK-013
/**
 * AI draft service for work note generation using GPT-4.5
 */

import type { Env } from '../types/env';
import type { WorkNoteDraft, AIDraftTodo } from '../types/search';
import type { WorkNote } from '../types/work-note';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl } from '../utils/ai-gateway';

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

  constructor(private env: Env) {}

  /**
   * Generate work note draft from unstructured text input
   *
   * @param inputText - Unstructured text about work
   * @param options - Optional hints (category, personIds, deptName)
   * @returns Work note draft with title, content, category, and todo suggestions
   */
  async generateDraftFromText(
    inputText: string,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
    }
  ): Promise<WorkNoteDraft> {
    const prompt = this.constructDraftPrompt(inputText, options);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const draft = JSON.parse(response) as WorkNoteDraft;

      // Validate required fields
      if (!draft.title || !draft.content) {
        throw new Error('Invalid draft: missing title or content');
      }

      return draft;
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
   * @param options - Optional hints (category, personIds, deptName)
   * @returns Work note draft with title, content, category, and todo suggestions
   */
  async generateDraftFromTextWithContext(
    inputText: string,
    similarNotes: Array<{ title: string; content: string; category?: string }>,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
    }
  ): Promise<WorkNoteDraft> {
    const prompt = this.constructDraftPromptWithContext(inputText, similarNotes, options);
    const response = await this.callGPT(prompt);

    // Parse JSON response from GPT
    try {
      const draft = JSON.parse(response) as WorkNoteDraft;

      // Validate required fields
      if (!draft.title || !draft.content) {
        throw new Error('Invalid draft: missing title or content');
      }

      return draft;
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
      const todos = JSON.parse(response) as AIDraftTodo[];

      // Validate array
      if (!Array.isArray(todos)) {
        throw new Error('Invalid response: expected array of todos');
      }

      return todos;
    } catch (error) {
      console.error('Error parsing todo suggestions:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
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
    }
  ): string {
    const categoryHint = options?.category ? `\n\n카테고리 힌트: ${options.category}` : '';
    const deptHint = options?.deptName ? `\n\n부서 컨텍스트: ${options.deptName}` : '';

    return `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

${inputText}${categoryHint}${deptHint}

이를 분석하여 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용)
3. 제안 카테고리 (수업성적, KORUS, 기획, 행정 중 하나 또는 새로운 카테고리 추론)
4. 3-5개의 관련 할 일 항목과 제안 기한

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
    similarNotes: Array<{ title: string; content: string; category?: string }>,
    options?: {
      category?: string;
      personIds?: string[];
      deptName?: string;
    }
  ): string {
    const categoryHint = options?.category ? `\n\n카테고리 힌트: ${options.category}` : '';
    const deptHint = options?.deptName ? `\n\n부서 컨텍스트: ${options.deptName}` : '';

    // Build context from similar notes
    const contextText = similarNotes.length > 0
      ? `\n\n참고할 유사한 업무노트들:\n${similarNotes
          .map(
            (note, idx) => `
[참고 노트 ${idx + 1}]
제목: ${note.title}
카테고리: ${note.category || '없음'}
내용 요약: ${note.content.slice(0, 200)}...
`
          )
          .join('\n')}`
      : '';

    return `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

${inputText}${categoryHint}${deptHint}${contextText}

위의 유사한 업무노트들을 참고하여 일관된 형식과 카테고리를 사용하면서, 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어, 유사 노트의 제목 스타일 참고)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용, 유사 노트의 구조 참고)
3. 제안 카테고리 (유사 노트에서 사용된 카테고리 우선 고려, 또는 새로운 카테고리 추론)
4. 3-5개의 관련 할 일 항목과 제안 기한 (유사 노트의 할일 패턴 참고)

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

이 업무노트를 기반으로 3-5개의 실행 가능한 할 일을 제안해주세요.

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

    const requestBody = {
      model: this.env.OPENAI_MODEL_CHAT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: AIDraftService.GPT_MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_object' }, // Ensure JSON response
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
