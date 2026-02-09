// Trace: TASK-C.3
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import type {
  AIDraftReference,
  AIDraftTodo,
  EnhanceWorkNoteRequest,
  EnhanceWorkNoteResponse,
  ExistingTodoSummary,
  Person,
} from '@web/types/api';
import { useCallback, useEffect, useState } from 'react';

interface EnhanceWorkNoteMutationParams extends EnhanceWorkNoteRequest {
  workId: string;
}

export function useEnhanceWorkNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ workId, ...data }: EnhanceWorkNoteMutationParams) =>
      API.enhanceWorkNote(workId, data),
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: '오류',
        description: error.message || 'AI 업데이트에 실패했습니다.',
      });
    },
  });
}

// Extended todo type with stable UI identifier
export interface SuggestedNewTodo extends AIDraftTodo {
  uiId: string;
}

export interface EnhanceWorkNoteFormState {
  title: string;
  content: string;
  selectedCategoryIds: string[];
  selectedPersonIds: string[];
  baseRelatedWorkIds: string[];
  references: AIDraftReference[];
  selectedReferenceIds: string[];
  suggestedNewTodos: SuggestedNewTodo[];
  selectedNewTodoIds: string[];
  existingTodos: ExistingTodoSummary[];
  isSubmitting: boolean;
}

export interface EnhanceWorkNoteFormActions {
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setSelectedCategoryIds: (ids: string[]) => void;
  setSelectedPersonIds: (ids: string[]) => void;
  setSelectedReferenceIds: (ids: string[]) => void;
  handleCategoryToggle: (categoryId: string) => void;
  toggleNewTodo: (uiId: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  populateFromEnhanceResponse: (response: EnhanceWorkNoteResponse) => void;
}

export interface EnhanceWorkNoteFormData {
  taskCategories: Array<{ categoryId: string; name: string }>;
  persons: Person[];
  categoriesLoading: boolean;
  personsLoading: boolean;
}

export interface UseEnhanceWorkNoteFormOptions {
  onSuccess?: () => void;
  existingRelatedWorkIds?: string[];
}

export function useEnhanceWorkNoteForm(
  workId: string,
  options: UseEnhanceWorkNoteFormOptions = {}
) {
  const { onSuccess } = options;
  const baseRelatedWorkIds = options.existingRelatedWorkIds ?? [];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [references, setReferences] = useState<AIDraftReference[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [suggestedNewTodos, setSuggestedNewTodos] = useState<SuggestedNewTodo[]>([]);
  const [selectedNewTodoIds, setSelectedNewTodoIds] = useState<string[]>([]);
  const [existingTodos, setExistingTodos] = useState<ExistingTodoSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftCategoryName, setDraftCategoryName] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: taskCategories = [], isLoading: categoriesLoading } = useTaskCategories(true);
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const { toast } = useToast();

  // Sync category ID when categories load or draft category name changes
  useEffect(() => {
    if (draftCategoryName && taskCategories.length > 0) {
      const matchingCategory = taskCategories.find((cat) => cat.name === draftCategoryName);
      if (matchingCategory) {
        setSelectedCategoryIds([matchingCategory.categoryId]);
      } else {
        setSelectedCategoryIds([]);
      }
    }
  }, [draftCategoryName, taskCategories]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }, []);

  const toggleNewTodo = useCallback((uiId: string) => {
    setSelectedNewTodoIds((prev) =>
      prev.includes(uiId) ? prev.filter((id) => id !== uiId) : [...prev, uiId]
    );
  }, []);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setSelectedCategoryIds([]);
    setSelectedPersonIds([]);
    setReferences([]);
    setSelectedReferenceIds([]);
    setSuggestedNewTodos([]);
    setSelectedNewTodoIds([]);
    setExistingTodos([]);
    setDraftCategoryName(null);
  }, []);

  const populateFromEnhanceResponse = useCallback((response: EnhanceWorkNoteResponse) => {
    const { enhancedDraft, existingTodos: existingTodosList, references: aiReferences } = response;

    setTitle(enhancedDraft.title);
    setContent(enhancedDraft.content);
    setDraftCategoryName(enhancedDraft.category || null);
    setSelectedPersonIds(enhancedDraft.relatedPersonIds || []);
    setExistingTodos(existingTodosList);
    setReferences(aiReferences);
    setSelectedReferenceIds(aiReferences.map((reference) => reference.workId));

    // Add unique IDs to todos for stable React keys
    const todosWithIds = (enhancedDraft.todos || []).map((todo) => ({
      ...todo,
      uiId: crypto.randomUUID(),
    }));
    setSuggestedNewTodos(todosWithIds);
    // By default, all new todos are selected
    setSelectedNewTodoIds(todosWithIds.map((t) => t.uiId));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim() || !content.trim()) {
        toast({
          variant: 'destructive',
          title: '오류',
          description: '제목과 내용을 입력해주세요.',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const aiReferenceIds = references.map((reference) => reference.workId);
        const relatedWorkIdsSet = new Set(baseRelatedWorkIds);
        const selectedReferenceIdsSet = new Set(selectedReferenceIds);

        for (const aiReferenceId of aiReferenceIds) {
          if (selectedReferenceIdsSet.has(aiReferenceId)) {
            relatedWorkIdsSet.add(aiReferenceId);
          } else {
            relatedWorkIdsSet.delete(aiReferenceId);
          }
        }

        const relatedWorkIds = Array.from(relatedWorkIdsSet);
        const hasRelatedWorkSelectionSource =
          baseRelatedWorkIds.length > 0 || aiReferenceIds.length > 0;

        // Update work note
        await API.updateWorkNote(workId, {
          title: title.trim(),
          content: content.trim(),
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
          relatedWorkIds: hasRelatedWorkSelectionSource ? relatedWorkIds : undefined,
        });

        // Create selected new todos
        const todosToCreate = suggestedNewTodos.filter((t) => selectedNewTodoIds.includes(t.uiId));

        if (todosToCreate.length > 0) {
          const todoCreationResults = await Promise.allSettled(
            todosToCreate.map((todo) =>
              API.createWorkNoteTodo(workId, {
                title: todo.title,
                description: todo.description,
                dueDate: todo.dueDate,
                repeatRule: 'NONE',
              })
            )
          );

          const successfulCount = todoCreationResults.filter(
            (r) => r.status === 'fulfilled'
          ).length;
          const failedCount = todosToCreate.length - successfulCount;

          if (failedCount > 0) {
            toast({
              variant: 'destructive',
              title: '일부 할일 생성 실패',
              description: `업무노트는 업데이트되었지만, ${failedCount}개의 할일 생성에 실패했습니다.`,
            });
          } else {
            toast({
              title: '성공',
              description: `업무노트가 업데이트되고 ${todosToCreate.length}개의 할일이 추가되었습니다.`,
            });
          }
        } else {
          toast({
            title: '성공',
            description: '업무노트가 업데이트되었습니다.',
          });
        }

        void queryClient.invalidateQueries({ queryKey: ['todos'] });
        void queryClient.invalidateQueries({ queryKey: ['work-notes'] });
        void queryClient.invalidateQueries({ queryKey: ['work-notes-with-stats'] });
        void queryClient.invalidateQueries({ queryKey: ['work-note-detail', workId] });
        void queryClient.invalidateQueries({ queryKey: ['work-note-todos', workId] });

        resetForm();
        onSuccess?.();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '오류',
          description: error instanceof Error ? error.message : '업데이트 중 오류가 발생했습니다.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      title,
      content,
      selectedCategoryIds,
      selectedPersonIds,
      baseRelatedWorkIds,
      references,
      selectedReferenceIds,
      suggestedNewTodos,
      selectedNewTodoIds,
      workId,
      queryClient,
      toast,
      resetForm,
      onSuccess,
    ]
  );

  const state: EnhanceWorkNoteFormState = {
    title,
    content,
    selectedCategoryIds,
    selectedPersonIds,
    baseRelatedWorkIds,
    references,
    selectedReferenceIds,
    suggestedNewTodos,
    selectedNewTodoIds,
    existingTodos,
    isSubmitting,
  };

  const actions: EnhanceWorkNoteFormActions = {
    setTitle,
    setContent,
    setSelectedCategoryIds,
    setSelectedPersonIds,
    setSelectedReferenceIds,
    handleCategoryToggle,
    toggleNewTodo,
    handleSubmit,
    resetForm,
    populateFromEnhanceResponse,
  };

  const data: EnhanceWorkNoteFormData = {
    taskCategories,
    persons,
    categoriesLoading,
    personsLoading,
  };

  return { state, actions, data };
}
