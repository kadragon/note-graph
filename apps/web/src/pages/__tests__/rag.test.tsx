import userEvent from '@testing-library/user-event';
import { useDepartments } from '@web/hooks/use-departments';
import { usePersons } from '@web/hooks/use-persons';
import { useRAGQuery } from '@web/hooks/use-rag';
import { useWorkNotes } from '@web/hooks/use-work-notes';
import { render, screen, waitFor } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RAG from '../rag';

vi.mock('@web/hooks/use-rag', () => ({
  useRAGQuery: vi.fn(),
}));

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

vi.mock('@web/hooks/use-departments', () => ({
  useDepartments: vi.fn(),
}));

vi.mock('@web/hooks/use-work-notes', () => ({
  useWorkNotes: vi.fn(),
}));

vi.mock('../rag/components/filter-selectors', () => ({
  PersonFilterSelector: ({
    onSelectionChange,
    disabled,
  }: {
    onSelectionChange: (id: string | null) => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={() => onSelectionChange('person-1')} disabled={disabled}>
      select-person
    </button>
  ),
  DepartmentFilterSelector: () => <div />,
  WorkNoteFilterSelector: () => <div />,
}));

describe('rag page', () => {
  let mutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync = vi.fn().mockResolvedValue({ answer: '응답', contexts: [] });
    vi.mocked(useRAGQuery).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRAGQuery>);
    vi.mocked(usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);
    vi.mocked(useDepartments).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(useWorkNotes).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkNotes>);
  });

  it('submits a global query', async () => {
    const user = userEvent.setup();
    render(<RAG />);

    const input = screen.getByPlaceholderText('메시지를 입력하세요...') as HTMLInputElement;
    const submitButton = input.closest('form')?.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();

    await user.type(input, '질문');
    await user.click(submitButton as HTMLButtonElement);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ query: '질문', scope: 'global' });
    });
  });

  it('requires person filter selection before submitting', async () => {
    const user = userEvent.setup();
    render(<RAG />);

    await user.click(screen.getByRole('tab', { name: '사람' }));

    const input = screen.getByPlaceholderText('메시지를 입력하세요...') as HTMLInputElement;
    const submitButton = input.closest('form')?.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();

    await user.type(input, '질문');
    expect(submitButton as HTMLButtonElement).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'select-person' }));
    expect(submitButton as HTMLButtonElement).toBeEnabled();

    await user.click(submitButton as HTMLButtonElement);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        query: '질문',
        scope: 'person',
        personId: 'person-1',
      });
    });
  });
});
