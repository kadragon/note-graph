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
// Daily Report Prompt Default
// ============================================================================

export const DEFAULT_DAILY_REPORT_PROMPT = `당신은 일일 업무 플래너 어시스턴트입니다.
{{WRITER_CONTEXT}}

오늘 날짜: {{DATE}}

[오늘의 캘린더 일정]
{{CALENDAR_EVENTS}}

[오늘 할일]
{{TODAY_TODOS}}

[다가오는 할일 (이번 주)]
{{UPCOMING_TODOS}}

[백로그]
{{BACKLOG_TODOS}}

[이전 리포트 분석]
{{PREVIOUS_REPORT}}

위 정보를 종합 분석하여 오늘 하루를 효율적으로 보내기 위한 일일 리포트를 작성해주세요.

JSON 형식으로 반환:
{
  "scheduleSummary": "오늘의 일정과 할일을 종합한 요약 (2-3문장)",
  "todoPriorities": [
    {
      "todoTitle": "할일 제목",
      "reason": "우선순위 이유",
      "suggestedOrder": 1
    }
  ],
  "timeAllocation": [
    {
      "timeBlock": "09:00-10:00",
      "activity": "활동 내용",
      "reason": "이 시간에 배치한 이유"
    }
  ],
  "conflicts": [
    {
      "description": "충돌/주의사항 설명",
      "suggestion": "해결 제안"
    }
  ],
  "progressVsPrevious": "전일 대비 진행상황 분석 (이전 리포트가 없으면 '첫 리포트입니다')",
  "actionItems": ["핵심 실행 항목 1", "핵심 실행 항목 2"]
}

중요 지침:
- 일정과 할일의 시간 충돌을 감지하세요
- 할일의 긴급성과 중요도를 고려하여 우선순위를 제안하세요
- 캘린더 일정이 없더라도 할일만으로 유용한 분석을 제공하세요
- 이전 리포트가 있으면 진행상황을 비교 분석하세요
- 실행 항목은 구체적이고 실천 가능해야 합니다
- 답변은 한국어로 작성하세요

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;

// ============================================================================
// AI Draft Prompt Defaults
// ============================================================================

export const DEFAULT_AI_DRAFT_CREATE_PROMPT = `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.
{{WRITER_CONTEXT}}

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

{{INPUT_SECTION}}{{CATEGORY_HINT}}{{DEPT_HINT}}{{TODO_DUE_DATE_CONTEXT}}

이를 분석하여 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용)
{{CATEGORY_INSTRUCTION}}
4. 내용에 적합한 개수의 관련 할 일 항목과 제안 기한 (필요한 만큼만 생성, 억지로 개수를 맞추지 말 것)

중요: 내용은 핵심만 간결하게 작성하세요. 불필요한 설명이나 반복을 피하고, 실제 업무에 필요한 정보만 포함하세요.
{{DUE_DATE_GUIDANCE}}
{{INJECTION_GUARD}}

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

export const DEFAULT_AI_DRAFT_CREATE_WITH_CONTEXT_PROMPT = `당신은 한국 직장에서 업무노트를 구조화하는 어시스턴트입니다.
{{WRITER_CONTEXT}}

사용자가 다음과 같은 업무에 대한 비구조화된 텍스트를 제공했습니다:

{{INPUT_SECTION}}{{CATEGORY_HINT}}{{DEPT_HINT}}{{SIMILAR_NOTES_CONTEXT}}{{TODO_DUE_DATE_CONTEXT}}

위의 유사한 업무노트들을 참고하여 일관된 형식과 카테고리를 사용하면서, 다음과 같은 구조화된 업무노트를 작성해주세요:
1. 간결한 제목 (한국어, 유사 노트의 제목 스타일 참고)
2. 잘 정리된 내용 (한국어, 마크다운 포맷 사용, 유사 노트의 구조 참고)
{{CATEGORY_INSTRUCTION}}
4. 내용에 적합한 개수의 관련 할 일 항목과 제안 기한 (유사 노트의 할 일 패턴 참고, 필요한 만큼만 생성)

중요: 내용은 핵심만 간결하게 작성하세요. 불필요한 설명이나 반복을 피하고, 실제 업무에 필요한 정보만 포함하세요.
{{DUE_DATE_GUIDANCE}}
{{INJECTION_GUARD}}

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

export const DEFAULT_AI_DRAFT_ENHANCE_PROMPT = `당신은 한국 직장에서 업무노트를 업데이트하는 어시스턴트입니다.
{{WRITER_CONTEXT}}

사용자가 기존 업무노트에 새로운 내용을 추가하려고 합니다.

[기존 업무노트]
제목:
{{EXISTING_TITLE}}
카테고리:
{{EXISTING_CATEGORY}}
내용:
{{EXISTING_CONTENT}}{{EXISTING_TODOS_SECTION}}{{TODO_DUE_DATE_CONTEXT}}

[추가할 새 내용]
{{NEW_CONTENT}}{{SIMILAR_NOTES_SECTION}}

위의 기존 업무노트와 새 내용을 **통합하여** 다음을 작성해주세요:
1. 업데이트된 제목 (기존 제목 유지 또는 필요시 수정)
2. 통합된 내용 (기존 내용 + 새 내용을 자연스럽게 병합, 마크다운 포맷)
{{CATEGORY_INSTRUCTION}}
4. **새로운** 할 일만 제안 (기존 할 일과 중복되지 않는 것만, 필요한 만큼만)

중요 지침:
- 기존 내용의 핵심 정보를 **반드시 보존**하세요
- 새 내용을 기존 내용과 자연스럽게 통합하세요
- 기존 할 일과 중복되는 할 일은 **절대 제안하지 마세요**
- 내용은 간결하게, 불필요한 반복 없이 작성하세요
{{DUE_DATE_GUIDANCE}}
{{INJECTION_GUARD}}

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

export const DEFAULT_AI_DRAFT_TODO_SUGGESTIONS_PROMPT = `당신은 업무노트에 대한 할 일을 제안하는 어시스턴트입니다.
{{WRITER_CONTEXT}}

업무노트:
제목:
{{WORK_NOTE_TITLE}}
내용:
{{WORK_NOTE_CONTENT}}
카테고리:
{{WORK_NOTE_CATEGORY}}{{ADDITIONAL_CONTEXT}}{{TODO_DUE_DATE_CONTEXT}}

이 업무노트를 기반으로 실행 가능한 할 일을 제안해주세요. (내용에 적합한 개수만큼 생성, 억지로 개수를 맞추지 말 것)
{{DUE_DATE_GUIDANCE}}
{{INJECTION_GUARD}}

JSON 배열로 반환:
[
  {
    "title": "...",
    "description": "...",
    "dueDateSuggestion": "YYYY-MM-DD" 또는 null
  }
]

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;

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
  {
    key: 'prompt.ai_draft.create',
    category: 'prompt',
    label: '업무노트 생성 프롬프트',
    description:
      '텍스트를 업무노트로 변환하는 프롬프트입니다.\n사용 가능한 변수: {{WRITER_CONTEXT}}, {{INPUT_SECTION}}, {{CATEGORY_HINT}}, {{DEPT_HINT}}, {{TODO_DUE_DATE_CONTEXT}}, {{CATEGORY_INSTRUCTION}}, {{DUE_DATE_GUIDANCE}}, {{INJECTION_GUARD}}',
    value: DEFAULT_AI_DRAFT_CREATE_PROMPT,
  },
  {
    key: 'prompt.ai_draft.create_with_context',
    category: 'prompt',
    label: '업무노트 생성 프롬프트 (유사노트 참고)',
    description:
      '유사 노트를 참고하여 업무노트를 생성하는 프롬프트입니다.\n사용 가능한 변수: {{WRITER_CONTEXT}}, {{INPUT_SECTION}}, {{CATEGORY_HINT}}, {{DEPT_HINT}}, {{SIMILAR_NOTES_CONTEXT}}, {{TODO_DUE_DATE_CONTEXT}}, {{CATEGORY_INSTRUCTION}}, {{DUE_DATE_GUIDANCE}}, {{INJECTION_GUARD}}',
    value: DEFAULT_AI_DRAFT_CREATE_WITH_CONTEXT_PROMPT,
  },
  {
    key: 'prompt.ai_draft.enhance',
    category: 'prompt',
    label: '업무노트 갱신 프롬프트',
    description:
      '기존 업무노트에 새 내용을 통합하는 프롬프트입니다.\n사용 가능한 변수: {{WRITER_CONTEXT}}, {{EXISTING_TITLE}}, {{EXISTING_CATEGORY}}, {{EXISTING_CONTENT}}, {{EXISTING_TODOS_SECTION}}, {{TODO_DUE_DATE_CONTEXT}}, {{NEW_CONTENT}}, {{SIMILAR_NOTES_SECTION}}, {{CATEGORY_INSTRUCTION}}, {{DUE_DATE_GUIDANCE}}, {{INJECTION_GUARD}}',
    value: DEFAULT_AI_DRAFT_ENHANCE_PROMPT,
  },
  {
    key: 'prompt.ai_draft.todo_suggestions',
    category: 'prompt',
    label: '할 일 제안 프롬프트',
    description:
      '업무노트 기반으로 할 일을 제안하는 프롬프트입니다.\n사용 가능한 변수: {{WRITER_CONTEXT}}, {{WORK_NOTE_TITLE}}, {{WORK_NOTE_CONTENT}}, {{WORK_NOTE_CATEGORY}}, {{ADDITIONAL_CONTEXT}}, {{TODO_DUE_DATE_CONTEXT}}, {{DUE_DATE_GUIDANCE}}, {{INJECTION_GUARD}}',
    value: DEFAULT_AI_DRAFT_TODO_SUGGESTIONS_PROMPT,
  },

  // Daily Report
  {
    key: 'prompt.daily_report.generate',
    category: 'prompt',
    label: '일일 리포트 생성 프롬프트',
    description:
      '일일 리포트를 생성하는 프롬프트입니다.\n사용 가능한 변수: {{WRITER_CONTEXT}}, {{DATE}}, {{CALENDAR_EVENTS}}, {{TODAY_TODOS}}, {{UPCOMING_TODOS}}, {{BACKLOG_TODOS}}, {{PREVIOUS_REPORT}}',
    value: DEFAULT_DAILY_REPORT_PROMPT,
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
