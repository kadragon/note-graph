// Trace: TASK-LLM-IMPORT
/**
 * Person import service for parsing unstructured person data using LLM
 */

import type { Env } from '../types/env';
import { parsedPersonDataSchema, type ParsedPersonData } from '../schemas/person';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { ZodError } from 'zod';

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

  constructor(private env: Env) {}

  /**
   * Parse person information from unstructured text
   *
   * @param inputText - Unstructured text containing person information
   * @returns Parsed person data
   *
   * @example
   * Input:
   * 소속	입학학생처 > 학생지원과
   * 이름(번호)	박진영 (310207)	직책	행정서기보
   * 전화번호	043-230-3038
   * 담당업무	학생회 및 동아리활동 지도
   * 재직상태	재직
   *
   * Output:
   * {
   *   personId: "310207",
   *   name: "박진영",
   *   phoneExt: "043-230-3038",
   *   currentDept: "학생지원과",
   *   currentPosition: "행정서기보",
   *   currentRoleDesc: "학생회 및 동아리활동 지도",
   *   employmentStatus: "재직"
   * }
   */
  async parsePersonFromText(inputText: string): Promise<ParsedPersonData> {
    const prompt = this.constructParsePrompt(inputText);
    const response = await this.callGPT(prompt);

    // Parse and validate JSON response using Zod schema
    try {
      const parsedJson = JSON.parse(response);

      // Convert null values to undefined for Zod optional fields
      // GPT may return null for missing fields, but Zod expects undefined
      const sanitizedJson = Object.fromEntries(
        Object.entries(parsedJson).filter(([, value]) => value !== null)
      );

      return parsedPersonDataSchema.parse(sanitizedJson);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('Zod validation error:', details);
        console.error('GPT response was:', response);
        throw new Error(`사람 정보 파싱에 실패했습니다: ${details}`);
      }
      console.error('Error parsing person response:', error);
      throw new Error('사람 정보 파싱에 실패했습니다. 입력 형식을 확인해주세요.');
    }
  }

  /**
   * Construct prompt for person data parsing
   */
  private constructParsePrompt(inputText: string): string {
    return `당신은 한국 직장의 인사 정보를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 형식의 인사 정보를 제공했습니다:

${inputText}

이를 분석하여 다음 규칙에 따라 JSON으로 변환해주세요:

규칙:
1. 이름(번호)에서 괄호 안의 번호가 personId입니다 (6자리 숫자)
2. 소속에서 ">" 로 구분된 경우 마지막 부서만 currentDept로 사용합니다
3. 전화번호는 phoneExt로 저장합니다 (하이픈 포함 가능)
4. 휴대전화는 무시합니다
5. 이메일은 무시합니다
6. 직책은 currentPosition입니다
7. 담당업무는 currentRoleDesc입니다
8. 재직상태는 employmentStatus입니다 (재직, 휴직, 퇴직 중 하나)

JSON 형식으로 반환:
{
  "personId": "6자리 숫자",
  "name": "이름",
  "phoneExt": "전화번호 또는 null",
  "currentDept": "마지막 부서명 또는 null",
  "currentPosition": "직책 또는 null",
  "currentRoleDesc": "담당업무 또는 null",
  "employmentStatus": "재직" 또는 "휴직" 또는 "퇴직"
}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * Call gpt-5-mini via AI Gateway
   *
   * @param prompt - Prompt for GPT
   * @returns GPT response text
   */
  private async callGPT(prompt: string): Promise<string> {
    const url = getAIGatewayUrl(this.env, 'chat/completions');

    const model = this.env.OPENAI_MODEL_LIGHTWEIGHT;

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
