// Trace: TASK-LLM-IMPORT
/**
 * Person import service for parsing unstructured person data using LLM
 */

import { ZodError } from 'zod';
import { type ParsedPersonData, parsedPersonDataSchema } from '../schemas/person';
import type { Env } from '../types/env';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { DEFAULT_PERSON_IMPORT_PROMPT } from './setting-defaults';
import type { SettingService } from './setting-service';

/**
 * Person Import Service
 *
 * Parses unstructured person information text using gpt-5-mini via AI Gateway
 */
export class PersonImportService {
  /**
   * Maximum number of completion tokens for GPT API calls
   * Set to 500 as person parsing is a simple task
   */
  private static readonly GPT_MAX_COMPLETION_TOKENS = 500;

  constructor(
    private env: Env,
    private settingService?: SettingService
  ) {}

  private getModel(): string {
    return (
      this.settingService?.getConfigOrEnv(
        'config.openai_model_lightweight',
        this.env.OPENAI_MODEL_LIGHTWEIGHT
      ) ?? this.env.OPENAI_MODEL_LIGHTWEIGHT
    );
  }

  /**
   * Parse person information from unstructured text
   *
   * @param inputText - Unstructured text containing person information
   * @returns Parsed person data
   *
   * @example
   * Input:
   * 소속	교육대학 > 교무과
   * 이름(번호)	홍길동 (123456)	직책	행정주사
   * 전화번호	043-123-4567
   * 담당업무	학사 업무 지원
   * 재직상태	재직
   *
   * Output:
   * {
   *   personId: "123456",
   *   name: "홍길동",
   *   phoneExt: "043-123-4567",
   *   currentDept: "교무과",
   *   currentPosition: "행정주사",
   *   currentRoleDesc: "학사 업무 지원",
   *   employmentStatus: "재직"
   * }
   */
  async parsePersonFromText(inputText: string): Promise<ParsedPersonData> {
    const prompt = this.constructParsePrompt(inputText);
    const response = await this.callGPT(prompt);

    // Parse and validate JSON response using Zod schema
    try {
      const parsedJson = JSON.parse(response) as Record<string, unknown>;

      // Convert null values to undefined for Zod optional fields
      // GPT may return null for missing fields, but Zod expects undefined
      const sanitizedJson: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsedJson)) {
        if (value !== null) {
          sanitizedJson[key] = value;
        }
      }

      return parsedPersonDataSchema.parse(sanitizedJson);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Zod validation error:', details);
        console.error('GPT response was:', response);
        throw new Error(`사람 정보 파싱에 실패했습니다: ${details}`);
      }
      console.error('Error parsing person response:', error);
      throw new Error(
        `사람 정보 파싱에 실패했습니다: ${error instanceof Error ? error.message : '입력 형식을 확인해주세요.'}`
      );
    }
  }

  /**
   * Construct prompt for person data parsing
   */
  private constructParsePrompt(inputText: string): string {
    const template =
      this.settingService?.getValue('prompt.person_import.parse', DEFAULT_PERSON_IMPORT_PROMPT) ??
      DEFAULT_PERSON_IMPORT_PROMPT;
    return template.replace('{{INPUT_TEXT}}', inputText);
  }

  /**
   * Call gpt-5-mini via AI Gateway
   *
   * @param prompt - Prompt for GPT
   * @returns GPT response text
   */
  private async callGPT(prompt: string): Promise<string> {
    const url = getAIGatewayUrl(this.env, 'chat/completions');

    const model = this.getModel();

    const requestBody = {
      model,
      messages: [
        {
          role: 'user' as const,
          content: prompt,
        },
      ],
      max_completion_tokens: PersonImportService.GPT_MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_object' as const },
      // Reasoning models (o1, o3, gpt-5) don't support temperature parameter
      ...(!isReasoningModel(model) && { temperature: 0.1 }),
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
