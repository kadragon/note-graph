// Unit tests for AIDraftService
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../../src/types/env';
import { AIDraftService } from '../../src/services/ai-draft-service';
import { RateLimitError } from '../../src/types/errors';
import type { WorkNote } from '../../src/types/work-note';

const testEnv = env as unknown as Env;

describe('AIDraftService', () => {
  let service: AIDraftService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new AIDraftService(testEnv);
  });

  describe('generateDraftFromText()', () => {
    it('should generate work note draft from unstructured text', async () => {
      // Arrange
      const inputText = '오늘 회의에서 새 프로젝트 기획안을 논의했습니다. 다음 주까지 초안 작성이 필요합니다.';
      const mockDraft = {
        title: '새 프로젝트 기획안 논의',
        content: '오늘 회의에서 새 프로젝트 기획안을 논의했습니다.\n\n다음 주까지 초안 작성이 필요합니다.',
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
                content: JSON.stringify(mockDraft),
              },
            },
          ],
        }),
      });

      // Act
      const result = await service.generateDraftFromText(inputText);

      // Assert
      expect(result).toEqual(mockDraft);
      expect(result.title).toBe('새 프로젝트 기획안 논의');
      expect(result.category).toBe('기획');
      expect(result.todos).toHaveLength(1);
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

      const mockTodos = [
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
          choices: [{ message: { content: JSON.stringify(mockTodos) } }],
        }),
      });

      // Act
      const result = await service.generateTodoSuggestions(workNote);

      // Assert
      expect(result).toEqual(mockTodos);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('기획안 작성');
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

    it('should handle todos with null due date', async () => {
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
      expect(result[0].dueDateSuggestion).toBeNull();
      expect(result[1].dueDateSuggestion).toBe('2024-01-15');
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
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow('No response from GPT');
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
      await expect(service.generateDraftFromText(inputText)).rejects.toThrow('No response from GPT');
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
});
