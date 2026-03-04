/**
 * Default settings for app_settings table.
 * Extracted from hardcoded values in service files.
 */

import type { DefaultSetting } from '../repositories/setting-repository';

// ============================================================================
// Prompt Defaults
// ============================================================================

export const DEFAULT_WRITER_CONTEXT =
  '업무노트를 작성하는 사람은 국립대학 정보전산원 전산주사(팀장)입니다. 이 직무/역할의 관점과 문체를 반영해 작성하세요.';

export const DEFAULT_PERSON_IMPORT_PROMPT = `당신은 한국 직장의 인사 정보를 구조화하는 어시스턴트입니다.

사용자가 다음과 같은 형식의 인사 정보를 제공했습니다:

{{INPUT_TEXT}}

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

export const DEFAULT_RAG_QUERY_PROMPT = `당신은 업무노트에 대한 질문에 답변하는 어시스턴트입니다.

다음 컨텍스트를 사용하여 사용자의 질문에 답변하세요.
컨텍스트에 관련 정보가 없으면 그렇게 말하세요.

{{CONTEXT_TEXT}}

---

질문: {{QUERY}}

답변은 한국어로 작성하고, 간결하게 작성하며, 가능한 경우 특정 업무노트를 참조하세요.`;

export const DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT = `다음 회의 정보를 바탕으로 핵심 키워드를 추출하세요.

주제: {{TOPIC}}
내용: {{DETAILS_RAW}}

반드시 JSON으로만 응답하세요:
{
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;

// ============================================================================
// All Default Settings
// ============================================================================

export const ALL_DEFAULT_SETTINGS: DefaultSetting[] = [
  // Prompts
  {
    key: 'prompt.ai_draft.writer_context',
    category: 'prompt',
    label: 'AI 작성자 역할 컨텍스트',
    description: '모든 AI 프롬프트에 공통으로 삽입되는 작성자 역할 설명입니다.',
    value: DEFAULT_WRITER_CONTEXT,
  },
  {
    key: 'prompt.person_import.parse',
    category: 'prompt',
    label: '인사정보 파싱 프롬프트',
    description:
      '비구조화된 인사 정보를 JSON으로 변환하는 프롬프트입니다.\n사용 가능한 변수: {{INPUT_TEXT}}',
    value: DEFAULT_PERSON_IMPORT_PROMPT,
  },
  {
    key: 'prompt.rag.query',
    category: 'prompt',
    label: 'RAG 질의 프롬프트',
    description:
      '업무노트 기반 질문-답변 프롬프트입니다.\n사용 가능한 변수: {{CONTEXT_TEXT}}, {{QUERY}}',
    value: DEFAULT_RAG_QUERY_PROMPT,
  },
  {
    key: 'prompt.meeting_minute.keywords',
    category: 'prompt',
    label: '회의록 키워드 추출 프롬프트',
    description:
      '회의 정보에서 핵심 키워드를 추출하는 프롬프트입니다.\n사용 가능한 변수: {{TOPIC}}, {{DETAILS_RAW}}',
    value: DEFAULT_MEETING_MINUTE_KEYWORDS_PROMPT,
  },

  // Config - Model selection
  {
    key: 'config.openai_model_chat',
    category: 'config',
    label: 'ChatGPT 모델 (기본)',
    description:
      'AI 초안 생성, RAG 등 고품질 응답이 필요한 작업에 사용하는 모델입니다. 환경변수 OPENAI_MODEL_CHAT의 오버라이드.',
    value: '',
  },
  {
    key: 'config.openai_model_embedding',
    category: 'config',
    label: '임베딩 모델',
    description:
      '텍스트 임베딩 생성에 사용하는 모델입니다. 환경변수 OPENAI_MODEL_EMBEDDING의 오버라이드.',
    value: '',
  },
  {
    key: 'config.openai_model_lightweight',
    category: 'config',
    label: 'ChatGPT 모델 (경량)',
    description:
      '키워드 추출, 인사정보 파싱 등 간단한 작업에 사용하는 모델입니다. 환경변수 OPENAI_MODEL_LIGHTWEIGHT의 오버라이드.',
    value: '',
  },
];
