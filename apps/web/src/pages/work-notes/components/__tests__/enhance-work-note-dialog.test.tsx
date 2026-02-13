import userEvent from '@testing-library/user-event';
import { useEnhanceWorkNote } from '@web/hooks/use-enhance-work-note';
import { API } from '@web/lib/api';
import { render, screen, waitFor } from '@web/test/setup';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnhanceWorkNoteDialog } from '../enhance-work-note-dialog';

vi.mock('@web/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockMutateAsync = vi.fn();

vi.mock('@web/hooks/use-enhance-work-note', () => ({
  useEnhanceWorkNote: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@web/lib/api', () => ({
  API: {
    uploadWorkNoteFile: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('EnhanceWorkNoteDialog', () => {
  const defaultProps = {
    workId: 'work-1',
    open: true,
    onOpenChange: vi.fn(),
    onEnhanceSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(API.uploadWorkNoteFile).mockResolvedValue({} as never);
    mockMutateAsync.mockResolvedValue({
      enhancedDraft: {
        title: '향상된 제목',
        content: '향상된 내용',
        category: '',
        todos: [],
      },
      originalContent: '원본 내용',
      existingTodos: [],
      references: [],
    });
  });

  describe('dialog rendering', () => {
    it('renders dialog when open is true', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('AI로 업무노트 업데이트')).toBeInTheDocument();
    });

    it('does not render dialog when open is false', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form fields', () => {
    it('renders new content textarea', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      expect(screen.getByLabelText('추가할 내용')).toBeInTheDocument();
    });

    it('renders file upload button', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      expect(screen.getByText('파일 첨부')).toBeInTheDocument();
    });

    it('renders generate button', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /AI로 생성/i })).toBeInTheDocument();
    });
  });

  describe('form interaction', () => {
    it('allows entering new content', async () => {
      const user = userEvent.setup();
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      const textarea = screen.getByLabelText('추가할 내용');
      await user.type(textarea, '새로운 정보 추가');

      expect(textarea).toHaveValue('새로운 정보 추가');
    });

    it('calls enhance API on generate button click', async () => {
      const user = userEvent.setup();
      const onEnhanceSuccess = vi.fn();
      render(<EnhanceWorkNoteDialog {...defaultProps} onEnhanceSuccess={onEnhanceSuccess} />);

      await user.type(screen.getByLabelText('추가할 내용'), '새 정보');
      await user.click(screen.getByRole('button', { name: /AI로 생성/i }));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          workId: 'work-1',
          newContent: '새 정보',
          generateNewTodos: true,
        });
      });

      expect(onEnhanceSuccess).toHaveBeenCalled();
    });

    it('uploads selected PDF to work note attachments after enhancement succeeds', async () => {
      const user = userEvent.setup();
      const onEnhanceSuccess = vi.fn();
      render(<EnhanceWorkNoteDialog {...defaultProps} onEnhanceSuccess={onEnhanceSuccess} />);

      const pdfFile = new File(['pdf'], 'source.pdf', { type: 'application/pdf' });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      await user.upload(fileInput, pdfFile);

      await user.click(screen.getByRole('button', { name: /AI로 생성/i }));

      await waitFor(() => {
        expect(onEnhanceSuccess).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-1', pdfFile);
      });
    });

    it('uploads PDF when MIME type is empty but extension is .pdf', async () => {
      const user = userEvent.setup();
      const onEnhanceSuccess = vi.fn();
      render(<EnhanceWorkNoteDialog {...defaultProps} onEnhanceSuccess={onEnhanceSuccess} />);

      const pdfFileWithoutMime = new File(['pdf'], 'source.pdf');
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      await user.upload(fileInput, pdfFileWithoutMime);

      await user.click(screen.getByRole('button', { name: /AI로 생성/i }));

      await waitFor(() => {
        expect(onEnhanceSuccess).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-1', pdfFileWithoutMime);
      });
    });

    it('shows warning toast when PDF attachment upload fails but still proceeds', async () => {
      const user = userEvent.setup();
      const onEnhanceSuccess = vi.fn();
      vi.mocked(API.uploadWorkNoteFile).mockRejectedValue(new Error('Upload failed'));
      render(<EnhanceWorkNoteDialog {...defaultProps} onEnhanceSuccess={onEnhanceSuccess} />);

      const pdfFile = new File(['pdf'], 'source.pdf', { type: 'application/pdf' });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      await user.upload(fileInput, pdfFile);

      await user.click(screen.getByRole('button', { name: /AI로 생성/i }));

      await waitFor(() => {
        expect(onEnhanceSuccess).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(API.uploadWorkNoteFile).toHaveBeenCalledWith('work-1', pdfFile);
      });
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '주의',
          description: 'PDF 첨부에 실패했습니다. 업무노트 업데이트는 유지되었습니다.',
        });
      });
    });

    it('does not auto-attach non-PDF files', async () => {
      const user = userEvent.setup();
      const onEnhanceSuccess = vi.fn();
      render(<EnhanceWorkNoteDialog {...defaultProps} onEnhanceSuccess={onEnhanceSuccess} />);

      const txtFile = new File(['text'], 'note.txt', { type: 'text/plain' });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      await user.upload(fileInput, txtFile);

      await user.click(screen.getByRole('button', { name: /AI로 생성/i }));

      await waitFor(() => {
        expect(onEnhanceSuccess).toHaveBeenCalled();
      });
      expect(API.uploadWorkNoteFile).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('disables generate button when no content or file is provided', () => {
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /AI로 생성/i });
      expect(generateButton).toBeDisabled();
    });

    it('enables generate button when content is entered', async () => {
      const user = userEvent.setup();
      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      const generateButton = screen.getByRole('button', { name: /AI로 생성/i });
      expect(generateButton).toBeDisabled();

      await user.type(screen.getByLabelText('추가할 내용'), '새 정보');
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows loading state when generating', () => {
      vi.mocked(useEnhanceWorkNote).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
      } as unknown as ReturnType<typeof useEnhanceWorkNote>);

      render(<EnhanceWorkNoteDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /처리 중/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /처리 중/i })).toBeDisabled();
    });
  });
});
