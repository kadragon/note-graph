import userEvent from '@testing-library/user-event';
import { usePDFJob, useSavePDFDraft, useUploadPDF } from '@web/hooks/use-pdf';
import { render, screen } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PDFUpload from '../pdf-upload';

vi.mock('@web/hooks/use-pdf', () => ({
  useUploadPDF: vi.fn(),
  usePDFJob: vi.fn(),
  useSavePDFDraft: vi.fn(),
}));

vi.mock('../pdf-upload/components/file-dropzone', () => ({
  FileDropzone: ({
    onFileSelect,
    disabled,
  }: {
    onFileSelect: (file: File) => void;
    disabled: boolean;
  }) => (
    <button
      type="button"
      onClick={() => onFileSelect({ size: 11 * 1024 * 1024, name: 'big.pdf' } as File)}
      disabled={disabled}
    >
      select-file
    </button>
  ),
}));

describe('pdf-upload page', () => {
  let uploadMutateAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    uploadMutateAsync = vi.fn();
    vi.mocked(useUploadPDF).mockReturnValue({
      mutateAsync: uploadMutateAsync,
      isPending: false,
      isSuccess: false,
    } as unknown as ReturnType<typeof useUploadPDF>);
    vi.mocked(usePDFJob).mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof usePDFJob
    >);
    vi.mocked(useSavePDFDraft).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSavePDFDraft>);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('alerts when file exceeds 10MB and does not upload', async () => {
    const user = userEvent.setup();

    render(<PDFUpload />);

    await user.click(screen.getByRole('button', { name: 'select-file' }));

    expect(window.alert).toHaveBeenCalledWith('파일 크기는 10MB를 초과할 수 없습니다.');
    expect(uploadMutateAsync).not.toHaveBeenCalled();
  });
});
