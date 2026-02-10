// Unit tests for AIDraftService

import { env } from 'cloudflare:test';
import type { WorkNote } from '@shared/types/work-note';
import { AIDraftService } from '@worker/services/ai-draft-service';
import type { Env } from '@worker/types/env';
import { RateLimitError } from '@worker/types/errors';
import type { OpenTodoDueDateContextForAI } from '@worker/types/todo-due-date-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testEnv = env as unknown as Env;

// Fixed date for deterministic testing (2025-01-10 12:00:00 UTC)
const FIXED_DATE = new Date('2025-01-10T12:00:00.000Z');
const FIXED_DATE_STRING = '2025-01-10';

describe('AIDraftService', () => {
  let service: AIDraftService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Use fake timers for deterministic date testing
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);

    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new AIDraftService(testEnv);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateDraftFromText()', () => {
    it('should generate work note draft from unstructured text', async () => {
      // Arrange
      const inputText =
        '오늘 회의에서 새 프로젝트 기획안을 논의했습니다. 다음 주까지 초안 작성이 필요합니다.';
      const mockLLMResponse = {
        title: '새 프로젝트 기획안 논의',
        content:
          '오늘 회의에서 새 프로젝트 기획안을 논의했습니다.\n\n다음 주까지 초안 작성이 필요합니다.',
        category: '기획',
        todos: [
          {
            title: '기획안 초안 작성',
            description: '프로젝트 기획안 초안 작성',
            dueDateSuggestion: '2024-01-15',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockLLMResponse),
              },
            },
          ],
        }),
      });

      // Act
      const result = await service.generateDraftFromText(inputText);

      // Assert - result should have transformed todo with dueDate
      expect(result.title).toBe('새 프로젝트 기획안 논의');
      expect(result.category).toBe('기획');
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].dueDate).toBe('2024-01-15');
      expect(result.todos[0].title).toBe('기획안 초안 작성');
    });

    it('should include category hint when provided', async () => {
      // Arrange
      const inputText = '회의 내용';
      const options = { category: '회의' };
      const mockDraft = {
        title: '회의',
        content: '회의 내용',
        category: '회의',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText, options);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('회의'),
        })
      );
    });

    it('should include department hint when provided', async () => {
      // Arrange
      const inputText = '부서 업무';
      const options = { deptName: '개발팀' };
      const mockDraft = {
        title: '개발팀 업무',
        content: '부서 업무',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText, options);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('개발팀'),
        })
      );
    });

    it('should throw error when draft is missing required fields', async () => {
      // Arrange
      const inputText = '텍스트';
      const invalidDraft = {
        // Missing title and content
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(invalidDraft) } }],
        }),
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow(
        'Failed to parse AI response'
      );
    });

    it('should throw error when response is not valid JSON', async () => {
      // Arrange
      const inputText = '텍스트';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Not a JSON response' } }],
        }),
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow(
        'Failed to parse AI response'
      );
    });

    it('should throw RateLimitError on 429 status', async () => {
      // Arrange
      const inputText = '텍스트';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow(RateLimitError);
    });

    it('should throw error on API failure', async () => {
      // Arrange
      const inputText = '텍스트';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow('OpenAI API error');
    });

    it('should use JSON response format in request', async () => {
      // Arrange
      const inputText = '텍스트';
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"response_format":{"type":"json_object"}'),
        })
      );
    });

    it('should set temperature to 0.7', async () => {
      // Arrange
      const inputText = '텍스트';
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.7'),
        })
      );
    });

    it('should use max_completion_tokens instead of max_tokens', async () => {
      // Arrange
      const inputText = '텍스트';
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText);

      // Assert
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).toContain('"max_completion_tokens":3000');
      expect(callBody).not.toContain('"max_tokens"');
    });

    it('should default null due dates to today', async () => {
      // Arrange
      const inputText = '업무 내용';
      const mockDraft = {
        title: '업무',
        content: '내용',
        category: '업무',
        todos: [
          {
            title: '할 일 1',
            description: '설명 1',
            dueDateSuggestion: null,
          },
          {
            title: '할 일 2',
            description: '설명 2',
            dueDateSuggestion: '2025-01-15',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      const result = await service.generateDraftFromText(inputText);

      // Assert
      const todayDate = FIXED_DATE_STRING;
      expect(result.todos[0].dueDate).toBe(todayDate);
      expect(result.todos[1].dueDate).toBe('2025-01-15');
    });

    it('should use dueDate field instead of dueDateSuggestion', async () => {
      // Arrange
      const inputText = '업무 내용';
      const mockDraft = {
        title: '업무',
        content: '내용',
        category: '업무',
        todos: [
          {
            title: '할 일',
            description: '설명',
            dueDateSuggestion: '2025-01-20',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      const result = await service.generateDraftFromText(inputText);

      // Assert
      expect(result.todos[0]).toHaveProperty('dueDate');
      expect(result.todos[0]).not.toHaveProperty('dueDateSuggestion');
      expect(result.todos[0].dueDate).toBe('2025-01-20');
    });

    it('should handle todos without dueDateSuggestion field', async () => {
      // Arrange
      const inputText = '업무 내용';
      const mockDraft = {
        title: '업무',
        content: '내용',
        category: '업무',
        todos: [
          {
            title: '할 일',
            description: '설명',
            // No dueDateSuggestion field at all
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      const result = await service.generateDraftFromText(inputText);

      // Assert
      const todayDate = FIXED_DATE_STRING;
      expect(result.todos[0].dueDate).toBe(todayDate);
    });
  });

  describe('generateTodoSuggestions()', () => {
    it('should generate todo suggestions for work note', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '프로젝트 기획',
        contentRaw: '새 프로젝트 기획안을 작성해야 합니다.',
        category: '기획',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockLLMTodos = [
        {
          title: '기획안 작성',
          description: '프로젝트 기획안 초안 작성',
          dueDateSuggestion: '2024-01-15',
        },
        {
          title: '검토 미팅',
          description: '팀원들과 기획안 검토',
          dueDateSuggestion: '2024-01-20',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockLLMTodos) } }],
        }),
      });

      // Act
      const result = await service.generateTodoSuggestions(workNote);

      // Assert - result should have transformed todos with dueDate
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('기획안 작성');
      expect(result[0].dueDate).toBe('2024-01-15');
      expect(result[1].title).toBe('검토 미팅');
      expect(result[1].dueDate).toBe('2024-01-20');
    });

    it('should include context text when provided', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '업무 내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const contextText = '추가 컨텍스트 정보';
      const mockTodos = [
        {
          title: '할 일',
          description: '설명',
          dueDateSuggestion: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockTodos) } }],
        }),
      });

      // Act
      await service.generateTodoSuggestions(workNote, contextText);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('추가 컨텍스트 정보'),
        })
      );
    });

    it('should throw error when response is not an array', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ not: 'array' }) } }],
        }),
      });

      // Act & Assert
      await expect(service.generateTodoSuggestions(workNote)).rejects.toThrow(
        'Failed to parse AI response'
      );
    });

    it('should throw error when response is not valid JSON', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Invalid JSON' } }],
        }),
      });

      // Act & Assert
      await expect(service.generateTodoSuggestions(workNote)).rejects.toThrow(
        'Failed to parse AI response'
      );
    });

    it('should default null due dates to today for todo suggestions', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockTodos = [
        {
          title: '할 일 1',
          description: '설명 1',
          dueDateSuggestion: null,
        },
        {
          title: '할 일 2',
          description: '설명 2',
          dueDateSuggestion: '2024-01-15',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockTodos) } }],
        }),
      });

      // Act
      const result = await service.generateTodoSuggestions(workNote);

      // Assert
      const todayDate = FIXED_DATE_STRING;
      expect(result[0].dueDate).toBe(todayDate);
      expect(result[1].dueDate).toBe('2024-01-15');
    });

    it('should throw RateLimitError on 429 status', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      // Act & Assert
      await expect(service.generateTodoSuggestions(workNote)).rejects.toThrow(RateLimitError);
    });

    it('should include work note title and content in prompt', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '테스트 제목',
        contentRaw: '테스트 내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockTodos = [
        {
          title: '할 일',
          description: '설명',
          dueDateSuggestion: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockTodos) } }],
        }),
      });

      // Act
      await service.generateTodoSuggestions(workNote);

      // Assert
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).toContain('테스트 제목');
      expect(callBody).toContain('테스트 내용');
    });
  });

  describe('due date distribution context prompts', () => {
    const todoDueDateContext: OpenTodoDueDateContextForAI = {
      totalOpenTodos: 12,
      undatedOpenTodos: 3,
      topDueDateCounts: [
        { dueDate: '2026-02-14', count: 5 },
        { dueDate: '2026-02-15', count: 2 },
      ],
    };

    it('includes due date distribution context in draft prompt', async () => {
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      await service.generateDraftFromText('업무 텍스트', { todoDueDateContext });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('마감일 혼잡 Top 10'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('2026-02-14: 5건'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('과밀한 날짜를 피해서 제안'),
        })
      );
    });

    it('includes due date distribution context in contextual draft prompt', async () => {
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      await service.generateDraftFromTextWithContext(
        '업무 텍스트',
        [{ workId: 'WORK-1', title: '참고', content: '내용' }],
        { todoDueDateContext }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('총 미완료 할일: 12건'),
        })
      );
    });

    it('includes due date distribution context in todo suggestions prompt', async () => {
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const mockTodos = [{ title: '할 일', description: '설명', dueDateSuggestion: null }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockTodos) } }],
        }),
      });

      await service.generateTodoSuggestions(workNote, undefined, { todoDueDateContext });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('기준: 완료 제외(진행중/보류/중단), 전체 할일 범위'),
        })
      );
    });

    it('includes due date distribution context in enhance prompt', async () => {
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '프로젝트 기획',
        contentRaw: '기존 내용',
        category: '기획',
        projectId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        embeddedAt: null,
      };
      const mockDraft = {
        title: '업데이트 제목',
        content: '업데이트 내용',
        category: '기획',
        todos: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      await service.enhanceExistingWorkNote(workNote, [], '새 내용', { todoDueDateContext });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('마감일 미정: 3건'),
        })
      );
    });

    it('shows no-distribution message when context data is not provided', async () => {
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      await service.generateDraftFromText('업무 텍스트');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('분포 데이터 없음'),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle missing GPT response', async () => {
      // Arrange
      const inputText = '텍스트';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow(
        'No response from GPT'
      );
    });

    it('should handle malformed GPT response', async () => {
      // Arrange
      const inputText = '텍스트';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing choices
        }),
      });

      // Act & Assert
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow(
        'No response from GPT'
      );
    });

    it('should use AI Gateway URL', async () => {
      // Arrange
      const inputText = '텍스트';
      const mockDraft = {
        title: '제목',
        content: '내용',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.generateDraftFromText(inputText);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('gateway.ai.cloudflare.com'),
        expect.any(Object)
      );
    });
  });

  describe('enhanceExistingWorkNote()', () => {
    it('should enhance work note by merging new content with existing', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '프로젝트 기획',
        contentRaw: '기존 프로젝트 내용입니다.',
        category: '기획',
        projectId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        embeddedAt: null,
      };

      const existingTodos = [
        { title: '기존 할 일 1', description: '설명 1', status: '진행중', dueDate: '2025-01-15' },
        { title: '기존 할 일 2', description: '설명 2', status: '완료', dueDate: '2025-01-10' },
      ];

      const newContent = '추가된 새로운 내용입니다. 미팅 결과가 추가되었습니다.';

      const mockLLMResponse = {
        title: '프로젝트 기획 (업데이트)',
        content: '기존 프로젝트 내용입니다.\n\n## 미팅 결과\n추가된 새로운 내용입니다.',
        category: '기획',
        todos: [
          {
            title: '미팅 결과 정리',
            description: '새로운 할 일',
            dueDateSuggestion: '2025-01-20',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockLLMResponse) } }],
        }),
      });

      // Act
      const result = await service.enhanceExistingWorkNote(workNote, existingTodos, newContent);

      // Assert
      expect(result.title).toBe('프로젝트 기획 (업데이트)');
      expect(result.content).toContain('미팅 결과');
      expect(result.category).toBe('기획');
      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].title).toBe('미팅 결과 정리');
    });

    it('should include existing work note info in the prompt', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '테스트 제목',
        contentRaw: '테스트 내용',
        category: '테스트',
        projectId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        embeddedAt: null,
      };

      const existingTodos = [
        { title: '기존 할 일', description: '설명', status: '진행중', dueDate: '2025-01-15' },
      ];

      const newContent = '새 내용';

      const mockDraft = {
        title: '업데이트된 제목',
        content: '업데이트된 내용',
        category: '테스트',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.enhanceExistingWorkNote(workNote, existingTodos, newContent);

      // Assert
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).toContain('테스트 제목');
      expect(callBody).toContain('테스트 내용');
      expect(callBody).toContain('기존 할 일');
      expect(callBody).toContain('새 내용');
    });

    it('should throw RateLimitError on 429 status', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        projectId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        embeddedAt: null,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      // Act & Assert
      await expect(service.enhanceExistingWorkNote(workNote, [], '새 내용')).rejects.toThrow(
        RateLimitError
      );
    });

    it('should handle similar notes context', async () => {
      // Arrange
      const workNote: WorkNote = {
        workId: 'WORK-001',
        title: '업무',
        contentRaw: '내용',
        category: '업무',
        projectId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        embeddedAt: null,
      };

      const similarNotes = [
        {
          workId: 'WORK-002',
          title: '유사 노트',
          content: '유사 내용',
          category: '업무',
          similarityScore: 0.9,
        },
      ];

      const mockDraft = {
        title: '업데이트된 제목',
        content: '업데이트된 내용',
        category: '업무',
        todos: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockDraft) } }],
        }),
      });

      // Act
      await service.enhanceExistingWorkNote(workNote, [], '새 내용', {
        similarNotes,
      });

      // Assert
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).toContain('유사 노트');
    });
  });
});
