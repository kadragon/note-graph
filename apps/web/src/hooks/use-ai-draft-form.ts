// Trace: SPEC-worknote-1, TASK-032

import { useQueryClient } from '@tanstack/react-query';
import { usePersons } from '@web/hooks/use-persons';
import { useTaskCategories } from '@web/hooks/use-task-categories';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import { invalidateMany, workNoteRelatedKeys } from '@web/lib/query-invalidation';
import { qk } from '@web/lib/query-keys';
import type {
  AIDraftMeetingReference,
  AIDraftPayload,
  AIDraftReference,
  AIDraftTodo,
  Person,
} from '@web/types/api';
import { useCallback, useEffect, useState } from 'react';

// Extended todo type with stable UI identifier
export interface SuggestedTodo extends AIDraftTodo {
  uiId: string;
}

export interface AIDraftFormState {
  title: string;
  content: string;
  selectedCategoryIds: string[];
  selectedPersonIds: string[];
  suggestedTodos: SuggestedTodo[];
  references: AIDraftReference[];
  selectedReferenceIds: string[];
  meetingReferences?: AIDraftMeetingReference[];
  selectedMeetingReferenceIds?: string[];
  isSubmitting: boolean;
}

export interface AIDraftFormActions {
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setSelectedCategoryIds: (ids: string[]) => void;
  setSelectedPersonIds: (ids: string[]) => void;
  handleCategoryToggle: (categoryId: string) => void;
  handleRemoveTodo: (uiId: string) => void;
  setSelectedReferenceIds: (ids: string[]) => void;
  setSelectedMeetingReferenceIds?: (ids: string[]) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  populateDraft: (
    draft: AIDraftPayload,
    refs?: AIDraftReference[],
    meetingRefs?: AIDraftMeetingReference[]
  ) => void;
}

export interface AIDraftFormData {
  taskCategories: Array<{ categoryId: string; name: string }>;
  persons: Person[];
  categoriesLoading: boolean;
  personsLoading: boolean;
}

export interface UseAIDraftFormOptions {
  onSuccess?: () => void;
  onWorkNoteCreated?: (workNote: { id: string }) => Promise<void> | void;
  onWorkNoteCreatedError?: (error: unknown) => void;
}

export function useAIDraftForm(options: UseAIDraftFormOptions = {}) {
  const { onSuccess, onWorkNoteCreated, onWorkNoteCreatedError } = options;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [suggestedTodos, setSuggestedTodos] = useState<SuggestedTodo[]>([]);
  const [references, setReferences] = useState<AIDraftReference[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [meetingReferences, setMeetingReferences] = useState<AIDraftMeetingReference[]>([]);
  const [selectedMeetingReferenceIds, setSelectedMeetingReferenceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Store draft category name to handle async category loading
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

  const handleRemoveTodo = useCallback((uiId: string) => {
    setSuggestedTodos((prev) => prev.filter((todo) => todo.uiId !== uiId));
  }, []);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setSelectedCategoryIds([]);
    setSelectedPersonIds([]);
    setSuggestedTodos([]);
    setReferences([]);
    setSelectedReferenceIds([]);
    setMeetingReferences([]);
    setSelectedMeetingReferenceIds([]);
    setDraftCategoryName(null);
  }, []);

  const populateDraft = useCallback(
    (draft: AIDraftPayload, refs?: AIDraftReference[], meetingRefs?: AIDraftMeetingReference[]) => {
      setTitle(draft.title);
      setContent(draft.content);
      // Add unique IDs to todos for stable React keys
      setSuggestedTodos(
        (draft.todos || []).map((todo) => ({
          ...todo,
          uiId: crypto.randomUUID(),
        }))
      );
      // Store category name for async resolution
      setDraftCategoryName(draft.category || null);
      // Populate assignees if present in draft
      setSelectedPersonIds(draft.relatedPersonIds || []);

      if (refs) {
        setReferences(refs);
        setSelectedReferenceIds(refs.map((ref) => ref.workId));
      }

      if (meetingRefs) {
        setMeetingReferences(meetingRefs);
        setSelectedMeetingReferenceIds(meetingRefs.map((ref) => ref.meetingId));
      }
    },
    []
  );

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
        // Create work note first
        const workNote = await API.createWorkNote({
          title: title.trim(),
          content: content.trim(),
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          relatedPersonIds: selectedPersonIds.length > 0 ? selectedPersonIds : undefined,
          relatedWorkIds: selectedReferenceIds.length > 0 ? selectedReferenceIds : undefined,
          relatedMeetingIds:
            selectedMeetingReferenceIds.length > 0 ? selectedMeetingReferenceIds : undefined,
        });

        // Validate that work note was created with an ID
        if (!workNote?.id) {
          throw new Error('업무노트 생성에 실패했거나, 서버에서 잘못된 데이터를 반환했습니다.');
        }

        // Execute post-creation callback (e.g., PDF attachment)
        // NOTE: This runs BEFORE todo creation to ensure file uploads happen
        // as soon as the work note exists, independent of todo creation results
        if (onWorkNoteCreated) {
          try {
            await onWorkNoteCreated(workNote);
          } catch (error) {
            if (onWorkNoteCreatedError) {
              onWorkNoteCreatedError(error);
            } else {
              toast({
                variant: 'destructive',
                title: '오류',
                description: '후속 작업 중 오류가 발생했습니다. 업무노트는 생성되었습니다.',
              });
            }
          }
        }

        // Create todos if any suggested todos exist
        if (suggestedTodos.length > 0) {
          // Use Promise.allSettled for resilience to partial failures
          const todoCreationResults = await Promise.allSettled(
            suggestedTodos.map((todo) =>
              API.createWorkNoteTodo(workNote.id, {
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
          const failedCount = suggestedTodos.length - successfulCount;

          if (successfulCount > 0) {
            invalidateMany(queryClient, [qk.todosRoot()]);
          }

          if (failedCount > 0) {
            toast({
              variant: 'destructive',
              title: '일부 할일 생성 실패',
              description: `업무노트는 저장되었지만, ${failedCount}개의 할일 생성에 실패했습니다.${successfulCount > 0 ? ` ${successfulCount}개는 성공했습니다.` : ''}`,
            });
          } else {
            toast({
              title: '성공',
              description: `업무노트와 ${suggestedTodos.length}개의 할일이 저장되었습니다.`,
            });
          }
        } else {
          toast({
            title: '성공',
            description: '업무노트가 생성되었습니다.',
          });
        }

        invalidateMany(
          queryClient,
          workNoteRelatedKeys(undefined, {
            includeWorkNotes: true,
            includeWorkNotesWithStats: true,
          })
        );

        // Reset form and call success callback
        resetForm();
        onSuccess?.();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '오류',
          description: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
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
      selectedReferenceIds,
      selectedMeetingReferenceIds,
      suggestedTodos,
      queryClient,
      toast,
      resetForm,
      onSuccess,
      onWorkNoteCreated,
      onWorkNoteCreatedError,
    ]
  );

  const state: AIDraftFormState = {
    title,
    content,
    selectedCategoryIds,
    selectedPersonIds,
    suggestedTodos,
    references,
    selectedReferenceIds,
    meetingReferences,
    selectedMeetingReferenceIds,
    isSubmitting,
  };

  const actions: AIDraftFormActions = {
    setTitle,
    setContent,
    setSelectedCategoryIds,
    setSelectedPersonIds,
    handleCategoryToggle,
    handleRemoveTodo,
    setSelectedReferenceIds,
    setSelectedMeetingReferenceIds,
    handleSubmit,
    resetForm,
    populateDraft,
  };

  const data: AIDraftFormData = {
    taskCategories,
    persons,
    categoriesLoading,
    personsLoading,
  };

  return { state, actions, data };
}
